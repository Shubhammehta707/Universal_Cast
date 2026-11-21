export class SfuServiceError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}
//# sourceMappingURL=types.js.map