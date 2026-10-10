import os
from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException, RequestEntityTooLarge

from config import Config
from database import db
from database.repository import SettingsRepository
from routes.api_routes import api_bp
from services.sample_data_service import ensure_sample_archives

load_dotenv()


def create_app(test_config: dict = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    os.makedirs(os.path.dirname(Config.DEFAULT_DB_PATH), exist_ok=True)

    if test_config:
        app.config.update(test_config)

    os.makedirs(app.config["UPLOADS_DIR"], exist_ok=True)
    os.makedirs(app.config["TEMP_EXTRACT_DIR"], exist_ok=True)
    os.makedirs(app.config["DATA_DIR"], exist_ok=True)

    CORS(
        app,
        resources={r"/api/*": {"origins": app.config.get("CORS_ORIGINS", "*")}},
        expose_headers=["Content-Disposition"],
    )

    db.init_app(app)
    app.register_blueprint(api_bp)

    # Consistent JSON error handlers without internal stack trace leakage
    @app.errorhandler(RequestEntityTooLarge)
    def handle_file_too_large(_err):
        return (
            jsonify(
                {
                    "success": False,
                    "error": {
                        "code": "UPLOAD_TOO_LARGE",
                        "message": f"Uploaded file exceeds maximum allowed size limit.",
                    },
                }
            ),
            413,
        )

    @app.errorhandler(404)
    def handle_not_found(_err):
        return (
            jsonify(
                {
                    "success": False,
                    "error": {
                        "code": "NOT_FOUND",
                        "message": "The requested API endpoint or resource was not found.",
                    },
                }
            ),
            404,
        )

    @app.errorhandler(HTTPException)
    def handle_http_exception(err):
        return (
            jsonify(
                {
                    "success": False,
                    "error": {
                        "code": err.name.upper().replace(" ", "_"),
                        "message": err.description,
                    },
                }
            ),
            err.code,
        )

    @app.errorhandler(Exception)
    def handle_unexpected_exception(_err):
        return (
            jsonify(
                {
                    "success": False,
                    "error": {
                        "code": "INTERNAL_SERVER_ERROR",
                        "message": "An unexpected server error occurred while processing the request.",
                    },
                }
            ),
            500,
        )

    with app.app_context():
        db.create_all()
        SettingsRepository.ensure_defaults()
        ensure_sample_archives(app.config["DATA_DIR"])

    return app


if __name__ == "__main__":
    flask_app = create_app()
    port = int(os.environ.get("PORT", 5000))
    flask_app.run(host="0.0.0.0", port=port, debug=False)
