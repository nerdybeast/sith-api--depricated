module.exports = function(req, res, next) {
    return next(new Error(`${req.method} not supported at ${req.originalUrl}`));
}