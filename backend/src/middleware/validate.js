const { HttpError } = require("../utils/http-error");

function validate(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      return next(new HttpError(400, "Validation failed.", issues));
    }

    req.validated = parsed.data;
    return next();
  };
}

module.exports = {
  validate,
};
