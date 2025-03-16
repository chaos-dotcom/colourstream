"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const tusdHooksController_1 = require("../controllers/tusdHooksController");
const router = express_1.default.Router();
const tusdHooksController = new tusdHooksController_1.TusdHooksController();
// tusd webhook routes
router.post('/pre-create', tusdHooksController.handlePreCreate);
router.post('/post-create', tusdHooksController.handlePostCreate);
router.post('/post-receive', tusdHooksController.handlePostReceive);
router.post('/post-finish', tusdHooksController.handlePostFinish);
router.post('/post-terminate', tusdHooksController.handlePostTerminate);
exports.default = router;
