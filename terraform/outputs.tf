output "mcp_endpoint_url" {
  description = "URL of the MCP Streamable HTTP endpoint. Point your MCP client at this."
  value       = "${aws_apigatewayv2_stage.default.invoke_url}/mcp"
}

output "api_id" {
  description = "API Gateway HTTP API ID."
  value       = aws_apigatewayv2_api.mcp.id
}

output "lambda_function_name" {
  description = "Name of the deployed Lambda function."
  value       = aws_lambda_function.mcp_server.function_name
}

output "lambda_function_arn" {
  description = "ARN of the deployed Lambda function."
  value       = aws_lambda_function.mcp_server.arn
}

output "lambda_log_group" {
  description = "CloudWatch Logs group for the Lambda function."
  value       = aws_cloudwatch_log_group.lambda.name
}
