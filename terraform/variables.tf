variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "eu-west-1"
}

variable "project_name" {
  description = "Name prefix used for all created resources."
  type        = string
  default     = "mcp-zebra"
}

variable "stage_name" {
  description = "API Gateway stage name (also appears in the invoke URL path)."
  type        = string
  default     = "prod"
}

variable "lambda_memory_size" {
  description = "Memory (MB) allocated to the Lambda function."
  type        = number
  default     = 512
}

variable "lambda_timeout" {
  description = "Lambda function timeout, in seconds."
  type        = number
  default     = 15
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention period for the Lambda's log group."
  type        = number
  default     = 14
}

variable "api_throttle_burst_limit" {
  description = "Max requests allowed in a single burst; the bucket takes ~24h to refill at burst_limit/86400 req/sec, giving a rolling ~24h cap of roughly this many requests."
  type        = number
  default     = 180
}

variable "tags" {
  description = "Additional tags applied to all resources."
  type        = map(string)
  default     = {}
}
