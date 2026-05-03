import { Router, type IRouter } from "express";
import healthRouter from "./health";
import readingsRouter from "./readings";
import conversationsRouter from "./conversations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(readingsRouter);
router.use(conversationsRouter);

export default router;
