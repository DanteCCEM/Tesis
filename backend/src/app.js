require("dotenv").config();

const express = require("express");
const cors = require("cors");
const apiRoutes = require("./routes");
const notFoundHandler = require("./middlewares/notFoundHandler");
const errorHandler = require("./middlewares/errorHandler");

const app = express();
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: corsOrigin.split(",").map((origin) => origin.trim()) }));
app.use(express.json());
app.use("/api", apiRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
