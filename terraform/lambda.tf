locals {
  function_name = "${var.project_name}-mcp"
  lambda_zip    = "${path.module}/../build/lambda.zip"
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_exec" {
  name               = "${local.function_name}-exec-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  tags               = local.common_tags
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_lambda_function" "mcp_server" {
  function_name = local.function_name
  role          = aws_iam_role.lambda_exec.arn

  filename         = local.lambda_zip
  source_code_hash = filebase64sha256(local.lambda_zip)

  handler       = "index.handler"
  runtime       = "nodejs20.x"
  architectures = ["arm64"]

  memory_size = var.lambda_memory_size
  timeout     = var.lambda_timeout

  depends_on = [aws_cloudwatch_log_group.lambda]

  tags = local.common_tags
}
