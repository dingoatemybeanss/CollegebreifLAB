import { Router, type IRouter } from "express";
import healthRouter from "./health";
import briefsRouter from "./briefs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(briefsRouter);

export default router;
