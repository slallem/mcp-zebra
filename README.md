# mcp-zebra

An [MCP](https://modelcontextprotocol.io) server exposing barcode/GTIN tools, deployed as an
AWS Lambda function behind an API Gateway HTTP API, provisioned with Terraform.

## Tools

| Tool                    | Description                                                                 |
| ------------------------ | ---------------------------------------------------------------------------- |
| `validate_gtin`          | Validates a GTIN-8/12/13/14 (EAN/UPC) number by recomputing its GS1 check digit. |
| `generate_gtin`           | Generates a random, check-digit-valid GTIN of a given length, optionally with a fixed prefix. |
| `generate_barcode_image`  | Renders a barcode PNG for a code + symbology (EAN13, EAN8, UPCA, UPCE, Code128, Code39, ITF14, QR Code, Data Matrix, PDF417, Aztec). |
| `decode_barcode_image`    | Decodes a barcode (1D or 2D) from a base64-encoded image.                    |

Barcode encoding/decoding is powered by [zxing-wasm](https://github.com/Sec-ant/zxing-wasm), a
WebAssembly build of the real [zxing-cpp](https://github.com/zxing-cpp/zxing-cpp) library — this
was a deliberate choice over pure-JS ports, which turned out to have an unreliable EAN/UPC reader
during testing.

## Architecture

- **Runtime**: Node.js 20, TypeScript, bundled to a single CommonJS file with esbuild.
- **MCP transport**: [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk)'s
  `WebStandardStreamableHTTPServerTransport`, used directly with the Fetch API `Request`/`Response`
  objects — no Express, no Lambda web-adapter layer. `src/lambda.ts` adapts API Gateway's
  `APIGatewayProxyEventV2` to/from those Fetch types. The transport runs **stateless** (no session
  ID, plain JSON responses instead of SSE) since API Gateway + Lambda is a buffered
  request/response model, not a place to hold long-lived SSE streams open.
- **Infra**: API Gateway HTTP API → Lambda (`ANY /mcp`), Terraform-managed, arm64.

```
MCP client -> API Gateway (HTTP API) -> Lambda (index.handler) -> McpServer + tools
```

## Repo layout

```
src/
  mcpServer.ts        # tool registration (shared by lambda + local dev)
  lambda.ts            # Lambda handler: API Gateway <-> Fetch Request/Response
  local.ts             # plain node:http server for local testing
  tools/
    gtin.ts             # GTIN check-digit math (validate/generate)
    generateBarcode.ts  # zxing-wasm writer
    decodeBarcode.ts     # zxing-wasm reader
    zxingModule.ts       # loads the zxing WASM binary for Node
terraform/            # API Gateway + Lambda + IAM + CloudWatch
esbuild.config.mjs      # bundles src/lambda.ts -> dist/index.js (+ copies the .wasm)
```

## Prerequisites

- Node.js 20+
- Terraform >= 1.5
- An AWS account/credentials configured (e.g. via `aws configure` or environment variables) with
  permission to create Lambda, API Gateway, IAM and CloudWatch Logs resources.

## Local development

```bash
npm install
npm run dev
# -> mcp-zebra listening locally at http://localhost:3000/mcp
```

Talk to it with any MCP client that supports Streamable HTTP, pointed at `http://localhost:3000/mcp`.
You can also poke it directly with `curl`, e.g. to list tools:

```bash
curl -s http://localhost:3000/mcp \
-H "Content-Type: application/json" \
-H "Accept: application/json, text/event-stream" \
-d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
| jq '.result.tools[] | {name, description}'
```

## Build & deploy

```bash
npm install
npm run tf:init     # terraform init (first time only)
npm run tf:apply     # builds the Lambda bundle, zips it, then terraform apply
```

`npm run tf:apply` runs `npm run package` first (esbuild bundle + copy the zxing WASM binary +
zip into `build/lambda.zip`), so Terraform always deploys the code you just built. Terraform will
print `mcp_endpoint_url` when it's done — that's the URL to point your MCP client at.

To tear everything down:

```bash
cd terraform && terraform destroy
```

### Useful npm scripts

| Script            | What it does                                                        |
| ------------------ | ---------------------------------------------------------------------- |
| `npm run dev`      | Local dev server with hot reload (`tsx watch src/local.ts`).        |
| `npm run typecheck` | `tsc --noEmit`                                                       |
| `npm run build`    | esbuild bundle to `dist/index.js` + copy `zxing_full.wasm` next to it. |
| `npm run package`   | `build` + zip into `build/lambda.zip`.                              |
| `npm run tf:plan`   | `package` + `terraform plan`.                                       |
| `npm run tf:apply`  | `package` + `terraform apply`.                                      |

### Terraform variables

All optional (see `terraform/variables.tf` for defaults): `aws_region` (default `us-east-1`),
`project_name` (default `mcp-zebra`), `stage_name` (default `prod`), `lambda_memory_size`,
`lambda_timeout`, `log_retention_days`, `tags`.

```bash
terraform apply -var="aws_region=eu-west-1" -var="stage_name=dev"
```

## Notes / demo-scope caveats

- CORS is wide open (`*`) and there's no authentication in front of the endpoint — fine for a
  demo, not for anything handling sensitive data. Put an authorizer (e.g. an API Gateway JWT
  authorizer) in front of it before using this for anything real.
- A fresh `McpServer`/transport pair is created per request rather than reused across warm Lambda
  invocations. This matches the SDK's documented stateless-HTTP pattern and sidesteps known bugs
  around reusing a stateless transport across requests; the cost (re-registering four tools) is
  negligible next to Lambda's own cold-start overhead.
