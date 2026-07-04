# services/api/data

SQLite database file (`hive_iot.db`) lives here at runtime, both for local
dev runs and inside the container (mounted as a volume in
`docker/docker-compose.yml`). The `.db` file itself is gitignored — only
this placeholder is tracked so the directory exists in a fresh checkout.
