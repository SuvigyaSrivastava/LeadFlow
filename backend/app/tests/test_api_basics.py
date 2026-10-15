def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200 and response.json() == {"status": "ok"}
    assert client.get("/api/health").status_code == 200


def test_config_endpoint(client):
    body = client.get("/api/config").json()
    assert body == {"timezone": "Asia/Kolkata", "ai_mode": "demo", "ai_provider": "demo"}


def test_unknown_route_uses_the_error_envelope(client):
    response = client.get("/api/nope")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_wrong_method_uses_the_error_envelope(client):
    response = client.delete("/api/leads")
    assert response.status_code == 405
    assert response.json()["error"]["code"] == "METHOD_NOT_ALLOWED"


def test_malformed_json_is_a_validation_error(client):
    response = client.post(
        "/api/leads", content="{not json", headers={"content-type": "application/json"}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_cors_allows_the_configured_origin_only(client):
    ok = client.options(
        "/api/leads",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"},
    )
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:3000"
    bad = client.options(
        "/api/leads",
        headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in bad.headers
