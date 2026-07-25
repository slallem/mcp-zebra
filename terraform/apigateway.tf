resource "aws_apigatewayv2_api" "mcp" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "DELETE", "OPTIONS"]
    allow_headers = ["content-type", "mcp-protocol-version", "mcp-session-id"]
  }

  tags = local.common_tags
}

resource "aws_apigatewayv2_integration" "mcp_lambda" {
  api_id                 = aws_apigatewayv2_api.mcp.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.mcp_server.invoke_arn
  payload_format_version = "2.0"
}

# The MCP Streamable HTTP transport speaks JSON-RPC over a single endpoint
# and dispatches on HTTP method (GET/POST/DELETE), so one route handles it.
resource "aws_apigatewayv2_route" "mcp" {
  api_id    = aws_apigatewayv2_api.mcp.id
  route_key = "ANY /mcp"
  target    = "integrations/${aws_apigatewayv2_integration.mcp_lambda.id}"
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.project_name}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.mcp.id
  name        = var.stage_name
  auto_deploy = true

  # Token-bucket throttle sized so a single burst of `throttling_burst_limit`
  # requests drains the bucket, and it takes ~24h of steady refill at
  # `throttling_rate_limit` req/sec to earn back a full burst. This behaves
  # as a rolling ~24h cap (not a fixed calendar-day reset like Usage Plan
  # quotas), e.g. one burst of up to `api_throttle_burst_limit` requests
  # roughly once per rolling day.
  default_route_settings {
    throttling_burst_limit = var.api_throttle_burst_limit
    throttling_rate_limit  = var.api_throttle_burst_limit / 86400
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId        = "$context.requestId"
      ip               = "$context.identity.sourceIp"
      requestTime      = "$context.requestTime"
      httpMethod       = "$context.httpMethod"
      routeKey         = "$context.routeKey"
      status           = "$context.status"
      protocol         = "$context.protocol"
      responseLength   = "$context.responseLength"
      integrationError = "$context.integrationErrorMessage"
    })
  }

  tags = local.common_tags
}

resource "aws_lambda_permission" "api_gateway_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.mcp_server.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.mcp.execution_arn}/*/*"
}
