# N.O.M.A.D. API Reference

N.O.M.A.D. exposes a JSON REST API for system management, offline content, maps, AI chat, RAG, downloads, and benchmarking. All application endpoints are served under `/api`.

## Base URL

```text
http://<your-server>/api
```

For local development, this is commonly:

```text
http://localhost:8080/api
```

For a deployed instance, replace `<your-server>` with your host name or IP address.

## Conventions

### Content type

Unless an endpoint explicitly accepts file uploads, send JSON:

```http
Content-Type: application/json
Accept: application/json
```

### Response format

Most endpoints return JSON. Success responses are usually resource objects, arrays, or an object containing fields such as `success`, `message`, `jobId`, or `id`.

Typical success response:

```json
{
  "success": true,
  "message": "Operation completed successfully"
}
```

Typical error response:

```json
{
  "message": "Resource not found"
}
```

### Common HTTP status codes

| Status | Meaning |
|---:|---|
| `200` | Request succeeded |
| `201` | Resource created |
| `202` | Long-running job accepted |
| `204` | Resource deleted or operation completed without response body |
| `400` | Invalid request body or query parameters |
| `404` | Resource not found |
| `409` | Conflict, such as a duplicate submission |
| `422` | Validation failed |
| `500` | Server-side failure |

### Async job pattern

Long-running operations such as map downloads, ZIM downloads, model downloads, embeddings, updates, and benchmarks usually follow this pattern:

1. Submit a request.
2. Receive a `jobId`, `benchmark_id`, or similar identifier.
3. Poll a status/list endpoint until the job completes.

Example async response:

```json
{
  "message": "Download started",
  "filename": "north-america.pmtiles",
  "jobId": "map-1717422000000"
}
```

---

# Health

## `GET /api/health`

Checks whether the API server is responding.

### curl

```bash
curl -s http://localhost:8080/api/health | jq
```

### Response `200`

```json
{
  "status": "ok"
}
```

---

# System

## `GET /api/system/info`

Returns host system information such as CPU, memory, disk, platform, and runtime details.

### curl

```bash
curl -s http://localhost:8080/api/system/info | jq
```

### Example response

```json
{
  "hostname": "nomad-box",
  "platform": "linux",
  "arch": "x64",
  "cpu": {
    "model": "Intel(R) Core(TM) i7-8700",
    "cores": 12,
    "load": 0.42
  },
  "memory": {
    "total": 33554432000,
    "used": 12314583040,
    "free": 21239848960
  },
  "disk": {
    "total": 512110190592,
    "used": 191873228800,
    "free": 320236961792
  },
  "uptimeSeconds": 86400
}
```

## `GET /api/system/internet-status`

Checks whether the server can reach the internet.

### curl

```bash
curl -s http://localhost:8080/api/system/internet-status | jq
```

### Example response

```json
true
```

## `GET /api/system/debug-info`

Returns diagnostic information useful for troubleshooting.

### curl

```bash
curl -s http://localhost:8080/api/system/debug-info | jq -r .debugInfo
```

### Example response

```json
{
  "debugInfo": "Docker: available\nPMTiles directory: /app/storage/maps\nZIM directory: /app/storage/zim\n"
}
```

## `GET /api/system/latest-version`

Checks for the latest available N.O.M.A.D. release.

### Query parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `force` | boolean | No | Force a fresh remote check instead of using cache |

### curl

```bash
curl -s "http://localhost:8080/api/system/latest-version?force=true" | jq
```

### Example response

```json
{
  "currentVersion": "1.4.0",
  "latestVersion": "1.5.0",
  "updateAvailable": true,
  "releaseUrl": "https://github.com/example/project-nomad/releases/tag/v1.5.0"
}
```

## `POST /api/system/update`

Starts a system update.

### curl

```bash
curl -s -X POST http://localhost:8080/api/system/update | jq
```

### Example response `202`

```json
{
  "success": true,
  "message": "System update started"
}
```

## `GET /api/system/update/status`

Returns current update status.

### curl

```bash
curl -s http://localhost:8080/api/system/update/status | jq
```

### Example response

```json
{
  "status": "running",
  "progress": 45,
  "message": "Pulling updated containers"
}
```

## `GET /api/system/update/logs`

Returns update logs.

### curl

```bash
curl -s http://localhost:8080/api/system/update/logs | jq -r .logs
```

### Example response

```json
{
  "logs": "Starting update...\nPulling images...\nRestarting services...\n"
}
```

## `GET /api/system/settings`

Gets a setting value by key.

### Query parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `key` | string | Yes | Setting key |

### curl

```bash
curl -s "http://localhost:8080/api/system/settings?key=theme" | jq
```

### Example response

```json
{
  "key": "theme",
  "value": "dark"
}
```

## `PATCH /api/system/settings`

Updates a setting.

### Request body

```json
{
  "key": "theme",
  "value": "dark"
}
```

### curl

```bash
curl -s -X PATCH http://localhost:8080/api/system/settings \
  -H 'Content-Type: application/json' \
  -d '{"key":"theme","value":"dark"}' | jq
```

### Example response

```json
{
  "success": true,
  "message": "Setting updated"
}
```

## `POST /api/system/subscribe-release-notes`

Subscribes an email address to release notes.

### Request body

```json
{
  "email": "user@example.com"
}
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/system/subscribe-release-notes \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com"}' | jq
```

### Example response

```json
{
  "success": true,
  "message": "Subscribed to release notes"
}
```

---

# System Services

## `GET /api/system/services`

Lists configured services and their current status.

### curl

```bash
curl -s http://localhost:8080/api/system/services | jq
```

### Example response

```json
[
  {
    "name": "kiwix",
    "displayName": "Kiwix",
    "installed": true,
    "running": true,
    "version": "3.5.0-2",
    "ports": [8080]
  },
  {
    "name": "ollama",
    "displayName": "Ollama",
    "installed": true,
    "running": false,
    "version": "0.6.8",
    "ports": [11434]
  }
]
```

## `POST /api/system/services/install`

Installs a service.

### Request body

```json
{
  "service_name": "kiwix"
}
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/system/services/install \
  -H 'Content-Type: application/json' \
  -d '{"service_name":"kiwix"}' | jq
```

### Example response

```json
{
  "success": true,
  "message": "Service installation started"
}
```

## `POST /api/system/services/force-reinstall`

Forces a reinstall of an installed service.

### Request body

```json
{
  "service_name": "kiwix"
}
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/system/services/force-reinstall \
  -H 'Content-Type: application/json' \
  -d '{"service_name":"kiwix"}' | jq
```

### Example response

```json
{
  "success": true,
  "message": "Service reinstall started"
}
```

## `POST /api/system/services/affect`

Starts, stops, or restarts a service.

### Request body

```json
{
  "service_name": "kiwix",
  "action": "restart"
}
```

Allowed `action` values:

```text
start | stop | restart
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/system/services/affect \
  -H 'Content-Type: application/json' \
  -d '{"service_name":"kiwix","action":"restart"}' | jq
```

### Example response

```json
{
  "success": true,
  "message": "Service restarted"
}
```

## `POST /api/system/services/check-updates`

Checks available updates for installed services.

### curl

```bash
curl -s -X POST http://localhost:8080/api/system/services/check-updates | jq
```

### Example response

```json
{
  "success": true,
  "message": "Service update check completed"
}
```

## `POST /api/system/services/update`

Updates a service to a specific version.

### Request body

```json
{
  "service_name": "kiwix",
  "target_version": "3.5.0-2"
}
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/system/services/update \
  -H 'Content-Type: application/json' \
  -d '{"service_name":"kiwix","target_version":"3.5.0-2"}' | jq
```

### Example response

```json
{
  "success": true,
  "message": "Service update started"
}
```

## `GET /api/system/services/:name/available-versions`

Lists available versions for a service.

### curl

```bash
curl -s http://localhost:8080/api/system/services/kiwix/available-versions | jq
```

### Example response

```json
{
  "versions": [
    {
      "tag": "3.5.0-2",
      "isLatest": true,
      "releaseUrl": "https://github.com/kiwix/kiwix-tools/releases"
    },
    {
      "tag": "3.4.0",
      "isLatest": false
    }
  ]
}
```

---

# Ollama Models and AI Chat

## `GET /api/ollama/models`

Lists available Ollama models. Supports searching, pagination, and recommended-only filtering.

### Query parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `query` | string | No | Search query |
| `recommendedOnly` | boolean | No | Return only recommended models |
| `limit` | number | No | Maximum models to return |
| `force` | boolean | No | Force refresh |
| `sort` | string | No | Sort mode; client defaults to `pulls` |

### curl

```bash
curl -s "http://localhost:8080/api/ollama/models?query=llama&limit=5" | jq
```

### Example response

```json
{
  "models": [
    {
      "name": "llama3.2",
      "description": "Meta Llama 3.2 model",
      "pulls": 1234567,
      "tags": ["latest", "3b"],
      "recommended": true
    }
  ],
  "hasMore": true
}
```

## `GET /api/ollama/installed-models`

Lists models installed on the local Ollama instance.

### curl

```bash
curl -s http://localhost:8080/api/ollama/installed-models | jq
```

### Example response

```json
[
  {
    "name": "llama3.2:latest",
    "size": 2019393189,
    "modified_at": "2026-05-16T14:15:00.000Z"
  }
]
```

## `POST /api/ollama/models`

Downloads a model.

### Request body

```json
{
  "model": "llama3.2:latest"
}
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/ollama/models \
  -H 'Content-Type: application/json' \
  -d '{"model":"llama3.2:latest"}' | jq
```

### Example response

```json
{
  "success": true,
  "message": "Model download started"
}
```

## `DELETE /api/ollama/models`

Deletes an installed model.

### Request body

```json
{
  "model": "llama3.2:latest"
}
```

### curl

```bash
curl -s -X DELETE http://localhost:8080/api/ollama/models \
  -H 'Content-Type: application/json' \
  -d '{"model":"llama3.2:latest"}' | jq
```

### Example response

```json
{
  "success": true,
  "message": "Model deleted"
}
```

## `POST /api/ollama/chat`

Sends a chat request. Supports regular JSON responses and streaming responses.

### Request body

```json
{
  "model": "llama3.2:latest",
  "messages": [
    {
      "role": "user",
      "content": "Summarize my offline library."
    }
  ],
  "stream": false,
  "useRag": true
}
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/ollama/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "llama3.2:latest",
    "messages": [{"role":"user","content":"Hello"}],
    "stream": false,
    "useRag": false
  }' | jq
```

### Example response

```json
{
  "message": {
    "role": "assistant",
    "content": "Hello! How can I help?"
  },
  "done": true
}
```

### Streaming curl

```bash
curl -N -X POST http://localhost:8080/api/ollama/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "llama3.2:latest",
    "messages": [{"role":"user","content":"Hello"}],
    "stream": true
  }'
```

### Example streaming event

```text
data: {"message":{"content":"Hello","thinking":""},"done":false}

data: {"message":{"content":"!","thinking":""},"done":true}
```

## `GET /api/chat/suggestions`

Returns suggested prompts.

### curl

```bash
curl -s http://localhost:8080/api/chat/suggestions | jq
```

### Example response

```json
{
  "suggestions": [
    "Summarize my downloaded maps",
    "What content is available offline?",
    "Check system health"
  ]
}
```

## `POST /api/ollama/configure-remote`

Configures a remote Ollama or LM Studio instance.

### Request body

```json
{
  "remoteUrl": "http://10.0.0.50:11434"
}
```

Set `remoteUrl` to `null` to clear remote configuration.

### curl

```bash
curl -s -X POST http://localhost:8080/api/ollama/configure-remote \
  -H 'Content-Type: application/json' \
  -d '{"remoteUrl":"http://10.0.0.50:11434"}' | jq
```

### Example response

```json
{
  "success": true,
  "message": "Remote Ollama configured"
}
```

## `GET /api/ollama/remote-status`

Checks remote Ollama configuration and connectivity.

### curl

```bash
curl -s http://localhost:8080/api/ollama/remote-status | jq
```

### Example response

```json
{
  "configured": true,
  "connected": true
}
```

---

# Chat Sessions

## `GET /api/chat/sessions`

Lists saved chat sessions.

### curl

```bash
curl -s http://localhost:8080/api/chat/sessions | jq
```

### Example response

```json
[
  {
    "id": "chat_01HXABC123",
    "title": "Offline planning",
    "model": "llama3.2:latest",
    "timestamp": "2026-05-16T14:20:00.000Z",
    "lastMessage": "Create an offline checklist"
  }
]
```

## `POST /api/chat/sessions`

Creates a chat session.

### Request body

```json
{
  "title": "Offline planning",
  "model": "llama3.2:latest"
}
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/chat/sessions \
  -H 'Content-Type: application/json' \
  -d '{"title":"Offline planning","model":"llama3.2:latest"}' | jq
```

### Example response

```json
{
  "id": "chat_01HXABC123",
  "title": "Offline planning",
  "model": "llama3.2:latest",
  "timestamp": "2026-05-16T14:20:00.000Z"
}
```

## `GET /api/chat/sessions/:id`

Gets one session and its messages.

### curl

```bash
curl -s http://localhost:8080/api/chat/sessions/chat_01HXABC123 | jq
```

### Example response

```json
{
  "id": "chat_01HXABC123",
  "title": "Offline planning",
  "model": "llama3.2:latest",
  "timestamp": "2026-05-16T14:20:00.000Z",
  "messages": [
    {
      "id": "msg_01",
      "role": "user",
      "content": "Create an offline checklist",
      "timestamp": "2026-05-16T14:21:00.000Z"
    }
  ]
}
```

## `PUT /api/chat/sessions/:id`

Updates session metadata.

### Request body

```json
{
  "title": "New title",
  "model": "llama3.2:latest"
}
```

### curl

```bash
curl -s -X PUT http://localhost:8080/api/chat/sessions/chat_01HXABC123 \
  -H 'Content-Type: application/json' \
  -d '{"title":"New title"}' | jq
```

### Example response

```json
{
  "id": "chat_01HXABC123",
  "title": "New title",
  "model": "llama3.2:latest",
  "timestamp": "2026-05-16T14:20:00.000Z"
}
```

## `POST /api/chat/sessions/:id/messages`

Adds a message to a chat session.

### Request body

```json
{
  "role": "user",
  "content": "What maps are installed?"
}
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/chat/sessions/chat_01HXABC123/messages \
  -H 'Content-Type: application/json' \
  -d '{"role":"user","content":"What maps are installed?"}' | jq
```

### Example response

```json
{
  "id": "msg_02",
  "role": "user",
  "content": "What maps are installed?",
  "timestamp": "2026-05-16T14:30:00.000Z"
}
```

## `DELETE /api/chat/sessions/:id`

Deletes one chat session.

### curl

```bash
curl -i -X DELETE http://localhost:8080/api/chat/sessions/chat_01HXABC123
```

### Example response

```http
HTTP/1.1 204 No Content
```

## `DELETE /api/chat/sessions/all`

Deletes all chat sessions.

### curl

```bash
curl -s -X DELETE http://localhost:8080/api/chat/sessions/all | jq
```

### Example response

```json
{
  "success": true,
  "message": "All chat sessions deleted"
}
```

---

# Knowledge Base / RAG

## `POST /api/rag/upload`

Uploads a document for embedding.

### Content type

```http
multipart/form-data
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/rag/upload \
  -F "file=@/path/to/document.pdf" | jq
```

### Example response

```json
{
  "message": "File uploaded and queued for embedding",
  "file_path": "/app/storage/rag/document.pdf"
}
```

## `GET /api/rag/files`

Lists stored RAG files.

### curl

```bash
curl -s http://localhost:8080/api/rag/files | jq
```

### Example response

```json
{
  "files": [
    "document.pdf",
    "manual.md"
  ]
}
```

## `DELETE /api/rag/files`

Deletes a stored RAG file.

### Request body

```json
{
  "source": "document.pdf"
}
```

### curl

```bash
curl -s -X DELETE http://localhost:8080/api/rag/files \
  -H 'Content-Type: application/json' \
  -d '{"source":"document.pdf"}' | jq
```

### Example response

```json
{
  "message": "File deleted"
}
```

## `GET /api/rag/active-jobs`

Lists active embedding jobs.

### curl

```bash
curl -s http://localhost:8080/api/rag/active-jobs | jq
```

### Example response

```json
[
  {
    "id": "embed_1717422000000",
    "source": "document.pdf",
    "status": "processing",
    "progress": 55,
    "message": "Embedding page 12 of 20"
  }
]
```

## `GET /api/rag/failed-jobs`

Lists failed embedding jobs.

### curl

```bash
curl -s http://localhost:8080/api/rag/failed-jobs | jq
```

### Example response

```json
[
  {
    "id": "embed_1717421999000",
    "source": "bad-file.pdf",
    "status": "failed",
    "error": "Unable to parse file"
  }
]
```

## `DELETE /api/rag/failed-jobs`

Cleans up failed embedding jobs and associated files.

### curl

```bash
curl -s -X DELETE http://localhost:8080/api/rag/failed-jobs | jq
```

### Example response

```json
{
  "message": "Failed jobs cleaned up",
  "cleaned": 2,
  "filesDeleted": 1
}
```

## `GET /api/rag/health`

Checks RAG subsystem health.

### curl

```bash
curl -s http://localhost:8080/api/rag/health | jq
```

### Example response

```json
{
  "online": true,
  "message": "RAG service is ready"
}
```

## `POST /api/rag/sync`

Syncs RAG database records with files present in storage.

### curl

```bash
curl -s -X POST http://localhost:8080/api/rag/sync | jq
```

### Example response

```json
{
  "success": true,
  "message": "RAG storage synced",
  "filesScanned": 12,
  "filesQueued": 2
}
```

---

# ZIM Files / Offline Content

## `GET /api/zim/list`

Lists local ZIM files.

### curl

```bash
curl -s http://localhost:8080/api/zim/list | jq
```

### Example response

```json
{
  "files": [
    {
      "filename": "wikipedia_en_simple_all_maxi_2026-01.zim",
      "title": "Simple English Wikipedia",
      "size_bytes": 1234567890,
      "path": "/app/storage/zim/wikipedia_en_simple_all_maxi_2026-01.zim"
    }
  ]
}
```

## `GET /api/zim/list-remote`

Lists remote ZIM files. Supports pagination and search.

### Query parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `start` | number | No | Starting offset |
| `count` | number | No | Number of results |
| `query` | string | No | Search query |

### curl

```bash
curl -s "http://localhost:8080/api/zim/list-remote?start=0&count=12&query=wikipedia" | jq
```

### Example response

```json
{
  "items": [
    {
      "name": "wikipedia_en_simple_all_maxi_2026-01.zim",
      "title": "Simple English Wikipedia",
      "summary": "Offline Simple English Wikipedia",
      "size_bytes": 1234567890,
      "url": "https://download.kiwix.org/zim/wikipedia/wikipedia_en_simple_all_maxi_2026-01.zim"
    }
  ],
  "start": 0,
  "count": 12,
  "total": 240
}
```

## `POST /api/zim/download-remote`

Downloads a remote ZIM file.

### Request body

```json
{
  "url": "https://download.kiwix.org/zim/wikipedia/wikipedia_en_simple_all_maxi_2026-01.zim",
  "metadata": {
    "title": "Simple English Wikipedia",
    "summary": "Offline Simple English Wikipedia",
    "author": "Kiwix",
    "size_bytes": 1234567890
  }
}
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/zim/download-remote \
  -H 'Content-Type: application/json' \
  -d '{
    "url":"https://download.kiwix.org/zim/wikipedia/wikipedia_en_simple_all_maxi_2026-01.zim",
    "metadata":{"title":"Simple English Wikipedia","summary":"Offline encyclopedia","author":"Kiwix","size_bytes":1234567890}
  }' | jq
```

### Example response

```json
{
  "message": "ZIM download started",
  "filename": "wikipedia_en_simple_all_maxi_2026-01.zim",
  "url": "https://download.kiwix.org/zim/wikipedia/wikipedia_en_simple_all_maxi_2026-01.zim"
}
```

## `POST /api/zim/download-category-tier`

Downloads all content for a category/tier combination.

### Request body

```json
{
  "categorySlug": "wikipedia",
  "tierSlug": "essential"
}
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/zim/download-category-tier \
  -H 'Content-Type: application/json' \
  -d '{"categorySlug":"wikipedia","tierSlug":"essential"}' | jq
```

### Example response

```json
{
  "message": "Category tier download started",
  "categorySlug": "wikipedia",
  "tierSlug": "essential",
  "resources": [
    "wikipedia_en_simple_all_maxi_2026-01.zim"
  ]
}
```

## `GET /api/zim/wikipedia`

Gets the current Wikipedia selector state.

### curl

```bash
curl -s http://localhost:8080/api/zim/wikipedia | jq
```

### Example response

```json
{
  "selected": "wikipedia_en_simple_all_maxi",
  "installed": true,
  "options": [
    {
      "id": "wikipedia_en_simple_all_maxi",
      "language": "English",
      "tier": "simple",
      "installed": true
    }
  ]
}
```

## `POST /api/zim/wikipedia/select`

Selects a Wikipedia edition/tier.

### Request body

```json
{
  "optionId": "wikipedia_en_simple_all_maxi"
}
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/zim/wikipedia/select \
  -H 'Content-Type: application/json' \
  -d '{"optionId":"wikipedia_en_simple_all_maxi"}' | jq
```

### Example response

```json
{
  "success": true,
  "jobId": "zim_1717422000000",
  "message": "Wikipedia selection queued"
}
```

## `DELETE /api/zim/:filename`

Deletes a local ZIM file.

### curl

```bash
curl -s -X DELETE "http://localhost:8080/api/zim/wikipedia_en_simple_all_maxi_2026-01.zim" | jq
```

### Example response

```json
{
  "message": "ZIM file deleted"
}
```

## Custom ZIM Libraries

### `GET /api/zim/custom-libraries`

Lists custom ZIM libraries.

```bash
curl -s http://localhost:8080/api/zim/custom-libraries | jq
```

Example response:

```json
[
  {
    "id": 1,
    "name": "Kiwix Library",
    "base_url": "https://download.kiwix.org/zim/",
    "is_default": true
  }
]
```

### `POST /api/zim/custom-libraries`

Adds a custom library.

```bash
curl -s -X POST http://localhost:8080/api/zim/custom-libraries \
  -H 'Content-Type: application/json' \
  -d '{"name":"My Mirror","base_url":"https://example.com/zim/"}' | jq
```

Example response:

```json
{
  "message": "Custom library added",
  "library": {
    "id": 2,
    "name": "My Mirror",
    "base_url": "https://example.com/zim/"
  }
}
```

### `DELETE /api/zim/custom-libraries/:id`

Removes a custom library.

```bash
curl -s -X DELETE http://localhost:8080/api/zim/custom-libraries/2 | jq
```

Example response:

```json
{
  "message": "Custom library removed"
}
```

### `GET /api/zim/browse-library`

Browses a remote ZIM library URL.

```bash
curl -s "http://localhost:8080/api/zim/browse-library?url=https%3A%2F%2Fdownload.kiwix.org%2Fzim%2F" | jq
```

Example response:

```json
{
  "directories": [
    {
      "name": "wikipedia",
      "url": "https://download.kiwix.org/zim/wikipedia/"
    }
  ],
  "files": [
    {
      "name": "sample.zim",
      "url": "https://download.kiwix.org/zim/sample.zim",
      "size_bytes": 123456
    }
  ]
}
```

---

# Maps

## `GET /api/maps/regions`

Lists available local map region files.

### curl

```bash
curl -s http://localhost:8080/api/maps/regions | jq
```

### Example response

```json
[
  {
    "name": "north-america.pmtiles",
    "path": "/app/storage/maps/north-america.pmtiles",
    "size": 987654321,
    "modifiedAt": "2026-05-16T13:00:00.000Z"
  }
]
```

## `GET /api/maps/styles`

Returns the MapLibre style JSON used by the frontend.

### curl

```bash
curl -s http://localhost:8080/api/maps/styles | jq
```

### Example response

```json
{
  "version": 8,
  "sources": {
    "basemap": {
      "type": "vector",
      "url": "pmtiles:///api/maps/tiles/basemap.pmtiles"
    }
  },
  "layers": [
    {
      "id": "background",
      "type": "background",
      "paint": {
        "background-color": "#f5f1e8"
      }
    }
  ]
}
```

## `GET /api/maps/global-map-info`

Returns information about the global map package.

### curl

```bash
curl -s http://localhost:8080/api/maps/global-map-info | jq
```

### Example response

```json
{
  "url": "https://example.com/maps/global.pmtiles",
  "date": "2026-05-01",
  "size": 9876543210,
  "key": "global"
}
```

## `POST /api/maps/download-global-map`

Starts download of the global map package.

### curl

```bash
curl -s -X POST http://localhost:8080/api/maps/download-global-map | jq
```

### Example response

```json
{
  "message": "Global map download started",
  "filename": "global.pmtiles",
  "jobId": "map_1717422000000"
}
```

## `GET /api/maps/curated-collections`

Lists curated map collections.

### curl

```bash
curl -s http://localhost:8080/api/maps/curated-collections | jq
```

### Example response

```json
[
  {
    "slug": "north-america",
    "title": "North America",
    "description": "Offline maps for North America",
    "installed": false,
    "resources": [
      {
        "filename": "north-america.pmtiles",
        "size_bytes": 987654321
      }
    ]
  }
]
```

## `POST /api/maps/fetch-latest-collections`

Refreshes map collection metadata from the configured source.

### curl

```bash
curl -s -X POST http://localhost:8080/api/maps/fetch-latest-collections | jq
```

### Example response

```json
{
  "success": true
}
```

## `POST /api/maps/download-base-assets`

Downloads base map assets required by the map UI.

### curl

```bash
curl -s -X POST http://localhost:8080/api/maps/download-base-assets | jq
```

### Example response

```json
{
  "success": true
}
```

## `POST /api/maps/download-remote-preflight`

Checks a remote map file before downloading.

### Request body

```json
{
  "url": "https://example.com/maps/virginia.pmtiles"
}
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/maps/download-remote-preflight \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com/maps/virginia.pmtiles"}' | jq
```

### Example response

```json
{
  "filename": "virginia.pmtiles",
  "size": 123456789
}
```

## `POST /api/maps/download-remote`

Downloads a remote map file.

### Request body

```json
{
  "url": "https://example.com/maps/virginia.pmtiles"
}
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/maps/download-remote \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com/maps/virginia.pmtiles"}' | jq
```

### Example response

```json
{
  "message": "Map download started",
  "filename": "virginia.pmtiles",
  "url": "https://example.com/maps/virginia.pmtiles"
}
```

## `POST /api/maps/download-collection`

Downloads a full curated collection.

### Request body

```json
{
  "slug": "north-america"
}
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/maps/download-collection \
  -H 'Content-Type: application/json' \
  -d '{"slug":"north-america"}' | jq
```

### Example response

```json
{
  "message": "Map collection download started",
  "slug": "north-america",
  "resources": [
    "north-america.pmtiles"
  ]
}
```

## `GET /api/maps/countries`

Lists countries available for map extraction.

### curl

```bash
curl -s http://localhost:8080/api/maps/countries | jq
```

### Example response

```json
{
  "countries": [
    {
      "code": "US",
      "name": "United States",
      "continent": "North America"
    }
  ]
}
```

## `GET /api/maps/country-groups`

Lists predefined country groups.

### curl

```bash
curl -s http://localhost:8080/api/maps/country-groups | jq
```

### Example response

```json
{
  "groups": [
    {
      "slug": "north-america",
      "name": "North America",
      "countries": ["US", "CA", "MX"]
    }
  ]
}
```

## `POST /api/maps/extract-preflight`

Preflights a map extraction request.

### Request body

```json
{
  "countries": ["US", "CA"],
  "maxzoom": 10
}
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/maps/extract-preflight \
  -H 'Content-Type: application/json' \
  -d '{"countries":["US","CA"],"maxzoom":10}' | jq
```

### Example response

```json
{
  "estimatedBytes": 2345678901,
  "countries": ["US", "CA"],
  "maxzoom": 10,
  "available": true
}
```

## `POST /api/maps/extract`

Starts a map extraction job.

### Request body

```json
{
  "countries": ["US", "CA"],
  "maxzoom": 10,
  "label": "us-canada",
  "estimatedBytes": 2345678901
}
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/maps/extract \
  -H 'Content-Type: application/json' \
  -d '{"countries":["US","CA"],"maxzoom":10,"label":"us-canada","estimatedBytes":2345678901}' | jq
```

### Example response

```json
{
  "message": "Map extraction started",
  "filename": "us-canada.pmtiles",
  "jobId": "extract_1717422000000"
}
```

## `DELETE /api/maps/:filename`

Deletes a local map file.

### curl

```bash
curl -s -X DELETE "http://localhost:8080/api/maps/virginia.pmtiles" | jq
```

### Example response

```json
{
  "message": "Map file deleted"
}
```

---

# Map Markers

Map markers are point features placed on the map. They support custom colors, icons, notes, visibility toggling, and future route metadata.

## Map marker object

```json
{
  "id": 1,
  "name": "Camp Alpha",
  "longitude": -77.0365,
  "latitude": 38.8977,
  "color": "yellow",
  "marker_type": "pin",
  "route_id": null,
  "route_order": null,
  "notes": "Primary meeting point",
  "custom_color": null,
  "icon": "tent",
  "icon_color": "#ffffff",
  "visible": true,
  "created_at": "2026-05-16T14:30:00.000Z",
  "updated_at": "2026-05-16T14:30:00.000Z"
}
```

## `GET /api/maps/markers`

Lists all map markers.

### curl

```bash
curl -s http://localhost:8080/api/maps/markers | jq
```

### Example response

```json
[
  {
    "id": 1,
    "name": "Camp Alpha",
    "longitude": -77.0365,
    "latitude": 38.8977,
    "color": "yellow",
    "marker_type": "pin",
    "route_id": null,
    "route_order": null,
    "notes": "Primary meeting point",
    "custom_color": null,
    "icon": "tent",
    "icon_color": "#ffffff",
    "visible": true,
    "created_at": "2026-05-16T14:30:00.000Z",
    "updated_at": "2026-05-16T14:30:00.000Z"
  }
]
```

## `POST /api/maps/markers`

Creates a map marker.

### Request body

```json
{
  "name": "Camp Alpha",
  "longitude": -77.0365,
  "latitude": 38.8977,
  "color": "yellow",
  "marker_type": "pin",
  "route_id": null,
  "route_order": null,
  "notes": "Primary meeting point",
  "custom_color": null,
  "icon": "tent",
  "icon_color": "#ffffff",
  "visible": true
}
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/maps/markers \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"Camp Alpha",
    "longitude":-77.0365,
    "latitude":38.8977,
    "color":"yellow",
    "marker_type":"pin",
    "notes":"Primary meeting point",
    "icon":"tent",
    "icon_color":"#ffffff",
    "visible":true
  }' | jq
```

### Example response `201`

```json
{
  "id": 1,
  "name": "Camp Alpha",
  "longitude": -77.0365,
  "latitude": 38.8977,
  "color": "yellow",
  "marker_type": "pin",
  "route_id": null,
  "route_order": null,
  "notes": "Primary meeting point",
  "custom_color": null,
  "icon": "tent",
  "icon_color": "#ffffff",
  "visible": true,
  "created_at": "2026-05-16T14:30:00.000Z",
  "updated_at": "2026-05-16T14:30:00.000Z"
}
```

## `PATCH /api/maps/markers/:id`

Updates a map marker. Fields that are not changing may be omitted.

### Request body

```json
{
  "name": "Camp Alpha Updated",
  "visible": false,
  "notes": "Temporarily hidden"
}
```

### curl

```bash
curl -s -X PATCH http://localhost:8080/api/maps/markers/1 \
  -H 'Content-Type: application/json' \
  -d '{"name":"Camp Alpha Updated","visible":false,"notes":"Temporarily hidden"}' | jq
```

### Example response

```json
{
  "id": 1,
  "name": "Camp Alpha Updated",
  "longitude": -77.0365,
  "latitude": 38.8977,
  "color": "yellow",
  "marker_type": "pin",
  "route_id": null,
  "route_order": null,
  "notes": "Temporarily hidden",
  "custom_color": null,
  "icon": "tent",
  "icon_color": "#ffffff",
  "visible": false,
  "created_at": "2026-05-16T14:30:00.000Z",
  "updated_at": "2026-05-16T15:00:00.000Z"
}
```

## `DELETE /api/maps/markers/:id`

Deletes a marker.

### curl

```bash
curl -i -X DELETE http://localhost:8080/api/maps/markers/1
```

### Example response

```http
HTTP/1.1 204 No Content
```

---

# Map Zones and Lines

Map zones are drawable map features. A zone can be a polygon, rectangle, circle, ellipse, or line. Lines are used for distance and navigation-route workflows.

## Geometry types

### Line geometry

```json
{
  "type": "line",
  "lineMode": "straight",
  "points": [
    { "longitude": -77.0365, "latitude": 38.8977 },
    { "longitude": -76.6122, "latitude": 39.2904 }
  ],
  "distanceMeters": 59234.2,
  "markerAId": null,
  "markerBId": null
}
```

### Polygon geometry

```json
{
  "type": "polygon",
  "lineMode": "straight",
  "points": [
    { "longitude": -77.05, "latitude": 38.90 },
    { "longitude": -77.02, "latitude": 38.90 },
    { "longitude": -77.02, "latitude": 38.88 },
    { "longitude": -77.05, "latitude": 38.88 }
  ],
  "closed": true
}
```

### Rectangle geometry

```json
{
  "type": "rectangle",
  "mode": "corner_to_corner",
  "bounds": {
    "north": 38.91,
    "south": 38.88,
    "east": -77.02,
    "west": -77.05
  }
}
```

### Circle geometry

```json
{
  "type": "circle",
  "center": { "longitude": -77.0365, "latitude": 38.8977 },
  "radiusMeters": 1000
}
```

### Ellipse geometry

```json
{
  "type": "ellipse",
  "center": { "longitude": -77.0365, "latitude": 38.8977 },
  "radiusXmeters": 1200,
  "radiusYmeters": 600,
  "rotationDegrees": 25
}
```

## Map zone object

```json
{
  "id": 10,
  "name": "Route to Baltimore",
  "zone_type": "line",
  "geometry": {
    "type": "line",
    "lineMode": "straight",
    "points": [
      { "longitude": -77.0365, "latitude": 38.8977 },
      { "longitude": -76.6122, "latitude": 39.2904 }
    ],
    "distanceMeters": 59234.2
  },
  "stroke_color": "#f97316",
  "fill_color": null,
  "stroke_width": 2,
  "fill_opacity": 0.2,
  "visible": true,
  "notes": "Primary route",
  "navigation_time": "55 min",
  "navigation_direction": "NE",
  "created_at": "2026-05-16T14:35:00.000Z",
  "updated_at": "2026-05-16T14:35:00.000Z"
}
```

## `GET /api/maps/zones`

Lists all map zones, including line zones.

### curl

```bash
curl -s http://localhost:8080/api/maps/zones | jq
```

### Example response

```json
[
  {
    "id": 10,
    "name": "Route to Baltimore",
    "zone_type": "line",
    "geometry": {
      "type": "line",
      "lineMode": "straight",
      "points": [
        { "longitude": -77.0365, "latitude": 38.8977 },
        { "longitude": -76.6122, "latitude": 39.2904 }
      ],
      "distanceMeters": 59234.2
    },
    "stroke_color": "#f97316",
    "fill_color": null,
    "stroke_width": 2,
    "fill_opacity": 0.2,
    "visible": true,
    "notes": "Primary route",
    "navigation_time": "55 min",
    "navigation_direction": "NE",
    "created_at": "2026-05-16T14:35:00.000Z",
    "updated_at": "2026-05-16T14:35:00.000Z"
  }
]
```

## `POST /api/maps/zones`

Creates a map zone. Use `zone_type: "line"` with line geometry to create a line/navigation route.

### Create line request body

```json
{
  "name": "Route to Baltimore",
  "zone_type": "line",
  "geometry": {
    "type": "line",
    "lineMode": "straight",
    "points": [
      { "longitude": -77.0365, "latitude": 38.8977 },
      { "longitude": -76.6122, "latitude": 39.2904 }
    ],
    "distanceMeters": 59234.2
  },
  "stroke_color": "#f97316",
  "fill_color": null,
  "stroke_width": 2,
  "fill_opacity": 0.2,
  "visible": true,
  "notes": "Primary route",
  "navigation_time": "55 min",
  "navigation_direction": "NE"
}
```

### curl: create line

```bash
curl -s -X POST http://localhost:8080/api/maps/zones \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"Route to Baltimore",
    "zone_type":"line",
    "geometry":{
      "type":"line",
      "lineMode":"straight",
      "points":[
        {"longitude":-77.0365,"latitude":38.8977},
        {"longitude":-76.6122,"latitude":39.2904}
      ],
      "distanceMeters":59234.2
    },
    "stroke_color":"#f97316",
    "fill_color":null,
    "stroke_width":2,
    "fill_opacity":0.2,
    "visible":true,
    "notes":"Primary route",
    "navigation_time":"55 min",
    "navigation_direction":"NE"
  }' | jq
```

### Example response `201`

```json
{
  "id": 10,
  "name": "Route to Baltimore",
  "zone_type": "line",
  "geometry": {
    "type": "line",
    "lineMode": "straight",
    "points": [
      { "longitude": -77.0365, "latitude": 38.8977 },
      { "longitude": -76.6122, "latitude": 39.2904 }
    ],
    "distanceMeters": 59234.2
  },
  "stroke_color": "#f97316",
  "fill_color": null,
  "stroke_width": 2,
  "fill_opacity": 0.2,
  "visible": true,
  "notes": "Primary route",
  "navigation_time": "55 min",
  "navigation_direction": "NE",
  "created_at": "2026-05-16T14:35:00.000Z",
  "updated_at": "2026-05-16T14:35:00.000Z"
}
```

### curl: create polygon

```bash
curl -s -X POST http://localhost:8080/api/maps/zones \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"Camp Boundary",
    "zone_type":"polygon",
    "geometry":{
      "type":"polygon",
      "lineMode":"straight",
      "points":[
        {"longitude":-77.05,"latitude":38.90},
        {"longitude":-77.02,"latitude":38.90},
        {"longitude":-77.02,"latitude":38.88},
        {"longitude":-77.05,"latitude":38.88}
      ],
      "closed":true
    },
    "stroke_color":"#2563eb",
    "fill_color":"#2563eb",
    "stroke_width":2,
    "fill_opacity":0.2,
    "visible":true,
    "notes":"Perimeter zone"
  }' | jq
```

## `PATCH /api/maps/zones/:id`

Updates a map zone. Fields that are not changing may be omitted.

### Update line request body

```json
{
  "name": "Route to Baltimore Updated",
  "navigation_time": "50 min",
  "navigation_direction": "NE",
  "visible": true
}
```

### curl

```bash
curl -s -X PATCH http://localhost:8080/api/maps/zones/10 \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"Route to Baltimore Updated",
    "navigation_time":"50 min",
    "navigation_direction":"NE",
    "visible":true
  }' | jq
```

### Example response

```json
{
  "id": 10,
  "name": "Route to Baltimore Updated",
  "zone_type": "line",
  "geometry": {
    "type": "line",
    "lineMode": "straight",
    "points": [
      { "longitude": -77.0365, "latitude": 38.8977 },
      { "longitude": -76.6122, "latitude": 39.2904 }
    ],
    "distanceMeters": 59234.2
  },
  "stroke_color": "#f97316",
  "fill_color": null,
  "stroke_width": 2,
  "fill_opacity": 0.2,
  "visible": true,
  "notes": "Primary route",
  "navigation_time": "50 min",
  "navigation_direction": "NE",
  "created_at": "2026-05-16T14:35:00.000Z",
  "updated_at": "2026-05-16T15:05:00.000Z"
}
```

### curl: update geometry

```bash
curl -s -X PATCH http://localhost:8080/api/maps/zones/10 \
  -H 'Content-Type: application/json' \
  -d '{
    "geometry":{
      "type":"line",
      "lineMode":"straight",
      "points":[
        {"longitude":-77.0365,"latitude":38.8977},
        {"longitude":-76.5000,"latitude":39.3000}
      ],
      "distanceMeters":65000
    }
  }' | jq
```

## `DELETE /api/maps/zones/:id`

Deletes a map zone or line.

### curl

```bash
curl -i -X DELETE http://localhost:8080/api/maps/zones/10
```

### Example response

```http
HTTP/1.1 204 No Content
```

---

# Downloads

## `GET /api/downloads/jobs`

Lists all background download jobs.

### curl

```bash
curl -s http://localhost:8080/api/downloads/jobs | jq
```

### Example response

```json
[
  {
    "id": "map_1717422000000",
    "filetype": "map",
    "filename": "virginia.pmtiles",
    "status": "downloading",
    "progress": 42,
    "downloadedBytes": 42000000,
    "totalBytes": 100000000
  }
]
```

## `GET /api/downloads/jobs/:filetype`

Lists download jobs filtered by file type.

Common `filetype` values include `map`, `zim`, and `model`.

### curl

```bash
curl -s http://localhost:8080/api/downloads/jobs/zim | jq
```

### Example response

```json
[
  {
    "id": "zim_1717422000001",
    "filetype": "zim",
    "filename": "wikipedia_en_simple_all_maxi_2026-01.zim",
    "status": "queued",
    "progress": 0
  }
]
```

## `DELETE /api/downloads/jobs/:jobId`

Removes a download job.

### curl

```bash
curl -i -X DELETE http://localhost:8080/api/downloads/jobs/map_1717422000000
```

### Example response

```http
HTTP/1.1 204 No Content
```

## `POST /api/downloads/jobs/:jobId/cancel`

Cancels a download job.

### curl

```bash
curl -s -X POST http://localhost:8080/api/downloads/jobs/map_1717422000000/cancel | jq
```

### Example response

```json
{
  "success": true,
  "message": "Download cancelled"
}
```

---

# Benchmarks

## `POST /api/benchmark/run`

Runs a benchmark.

### Query parameters

| Name | Type | Required | Description |
|---|---|---:|---|
| `sync` | boolean | No | If true, wait for benchmark completion |

### Request body

```json
{
  "benchmark_type": "full"
}
```

Common `benchmark_type` values:

```text
full | system | ai
```

### curl

```bash
curl -s -X POST "http://localhost:8080/api/benchmark/run?sync=false" \
  -H 'Content-Type: application/json' \
  -d '{"benchmark_type":"full"}' | jq
```

### Example response

```json
{
  "success": true,
  "benchmark_id": "bench_1717422000000",
  "message": "Benchmark started"
}
```

## `GET /api/benchmark/results`

Lists benchmark results.

### curl

```bash
curl -s http://localhost:8080/api/benchmark/results | jq
```

### Example response

```json
{
  "results": [
    {
      "id": "bench_1717422000000",
      "benchmark_type": "full",
      "score": 8123,
      "created_at": "2026-05-16T14:00:00.000Z"
    }
  ],
  "total": 1
}
```

## `GET /api/benchmark/results/latest`

Gets the latest benchmark result.

### curl

```bash
curl -s http://localhost:8080/api/benchmark/results/latest | jq
```

### Example response

```json
{
  "result": {
    "id": "bench_1717422000000",
    "benchmark_type": "full",
    "score": 8123,
    "created_at": "2026-05-16T14:00:00.000Z"
  }
}
```

## `POST /api/benchmark/submit`

Submits a benchmark to the central repository.

### Request body

```json
{
  "benchmark_id": "bench_1717422000000",
  "anonymous": true
}
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/benchmark/submit \
  -H 'Content-Type: application/json' \
  -d '{"benchmark_id":"bench_1717422000000","anonymous":true}' | jq
```

### Example response

```json
{
  "success": true,
  "message": "Benchmark submitted"
}
```

## `POST /api/benchmark/builder-tag`

Updates builder tag metadata for a benchmark result.

### Request body

```json
{
  "benchmark_id": "bench_1717422000000",
  "builder_tag": "raspberry-pi-5"
}
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/benchmark/builder-tag \
  -H 'Content-Type: application/json' \
  -d '{"benchmark_id":"bench_1717422000000","builder_tag":"raspberry-pi-5"}' | jq
```

### Example response

```json
{
  "success": true,
  "message": "Builder tag updated"
}
```

---

# Easy Setup, Manifests, and Content Updates

## `GET /api/easy-setup/curated-categories`

Lists curated categories for the setup wizard.

### curl

```bash
curl -s http://localhost:8080/api/easy-setup/curated-categories | jq
```

### Example response

```json
[
  {
    "slug": "wikipedia",
    "title": "Wikipedia",
    "installed": true,
    "status": "installed"
  }
]
```

## `POST /api/manifests/refresh`

Refreshes manifest caches.

### curl

```bash
curl -s -X POST http://localhost:8080/api/manifests/refresh | jq
```

### Example response

```json
{
  "success": true,
  "changed": {
    "zim_categories": true,
    "maps": false,
    "wikipedia": true
  }
}
```

## `POST /api/content-updates/check`

Checks available content updates.

### curl

```bash
curl -s -X POST http://localhost:8080/api/content-updates/check | jq
```

### Example response

```json
{
  "updates": [
    {
      "resource_id": "wikipedia_en_simple_all_maxi",
      "current_version": "2026-01",
      "latest_version": "2026-03",
      "size_bytes": 1234567890
    }
  ]
}
```

## `POST /api/content-updates/apply`

Applies one content update.

### Request body

```json
{
  "resource_id": "wikipedia_en_simple_all_maxi",
  "latest_version": "2026-03",
  "url": "https://download.kiwix.org/zim/wikipedia/example.zim"
}
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/content-updates/apply \
  -H 'Content-Type: application/json' \
  -d '{"resource_id":"wikipedia_en_simple_all_maxi","latest_version":"2026-03","url":"https://download.kiwix.org/zim/wikipedia/example.zim"}' | jq
```

### Example response

```json
{
  "success": true,
  "jobId": "update_1717422000000"
}
```

## `POST /api/content-updates/apply-all`

Applies multiple content updates.

### Request body

```json
{
  "updates": [
    {
      "resource_id": "wikipedia_en_simple_all_maxi",
      "latest_version": "2026-03",
      "url": "https://download.kiwix.org/zim/wikipedia/example.zim"
    }
  ]
}
```

### curl

```bash
curl -s -X POST http://localhost:8080/api/content-updates/apply-all \
  -H 'Content-Type: application/json' \
  -d '{"updates":[{"resource_id":"wikipedia_en_simple_all_maxi","latest_version":"2026-03","url":"https://download.kiwix.org/zim/wikipedia/example.zim"}]}' | jq
```

### Example response

```json
{
  "results": [
    {
      "resource_id": "wikipedia_en_simple_all_maxi",
      "success": true,
      "jobId": "update_1717422000000"
    }
  ]
}
```

---

# Documentation

## `GET /api/docs/list`

Lists available documentation pages.

### curl

```bash
curl -s http://localhost:8080/api/docs/list | jq
```

### Example response

```json
[
  {
    "title": "API Reference",
    "slug": "api-reference"
  },
  {
    "title": "Getting Started",
    "slug": "getting-started"
  }
]
```

---

# Quick CRUD Examples

## Create, update, list, and delete a line

```bash
# Create
LINE_ID=$(curl -s -X POST http://localhost:8080/api/maps/zones \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"Route Demo",
    "zone_type":"line",
    "geometry":{
      "type":"line",
      "lineMode":"straight",
      "points":[
        {"longitude":-77.0365,"latitude":38.8977},
        {"longitude":-76.6122,"latitude":39.2904}
      ],
      "distanceMeters":59234.2
    },
    "stroke_color":"#f97316",
    "fill_color":null,
    "stroke_width":2,
    "fill_opacity":0.2,
    "visible":true,
    "navigation_time":"55 min",
    "navigation_direction":"NE"
  }' | jq -r .id)

# List
curl -s http://localhost:8080/api/maps/zones | jq

# Update
curl -s -X PATCH "http://localhost:8080/api/maps/zones/${LINE_ID}" \
  -H 'Content-Type: application/json' \
  -d '{"navigation_time":"50 min","visible":true}' | jq

# Delete
curl -i -X DELETE "http://localhost:8080/api/maps/zones/${LINE_ID}"
```

## Create, update, list, and delete a marker

```bash
# Create
MARKER_ID=$(curl -s -X POST http://localhost:8080/api/maps/markers \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"Camp Alpha",
    "longitude":-77.0365,
    "latitude":38.8977,
    "color":"yellow",
    "marker_type":"pin",
    "notes":"Primary meeting point",
    "visible":true
  }' | jq -r .id)

# List
curl -s http://localhost:8080/api/maps/markers | jq

# Update
curl -s -X PATCH "http://localhost:8080/api/maps/markers/${MARKER_ID}" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Camp Alpha Updated","visible":false}' | jq

# Delete
curl -i -X DELETE "http://localhost:8080/api/maps/markers/${MARKER_ID}"
```
