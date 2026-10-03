import type { Request,Response } from "express";
import { erpCommandOperationsService } from "./erpCommandOperationsService";
import { erpCommandWorkerSupervisor } from "../crew-app/erp-commands/supervisor";

const actor=(req:Request)=>String(req.user?.userUuid??req.user?.id??"");
const correlation=(req:Request)=>req.requestId??"operator-action";
function fail(res:Response,error:any){const status=Number(error?.status)||500;res.status(status).json({error:status>=500?"operation_failed":String(error?.message??"operation_failed")});}
export async function listErpCommands(_req:Request,res:Response){try{res.json(await erpCommandOperationsService.list());}catch(e){fail(res,e);}}
export async function readBackErpCommand(req:Request,res:Response){try{res.json(await erpCommandOperationsService.readBack(req.params.commandUuid));}catch(e){fail(res,e);}}
export async function resolveErpCommand(req:Request,res:Response){try{res.json(await erpCommandOperationsService.resolve(req.params.commandUuid,actor(req),String(req.body?.reason??""),correlation(req)));}catch(e){fail(res,e);}}
export async function requeueErpCommand(req:Request,res:Response){try{res.json(await erpCommandOperationsService.requeue(req.params.commandUuid,actor(req),String(req.body?.reason??""),correlation(req)));}catch(e){fail(res,e);}}
export async function closeErpCommand(req:Request,res:Response){try{res.json(await erpCommandOperationsService.close(req.params.commandUuid,actor(req),String(req.body?.reason??""),correlation(req)));}catch(e){fail(res,e);}}
export async function erpWorkerHealth(_req:Request,res:Response){try{res.json(await erpCommandWorkerSupervisor.getOperationalHealth());}catch(e){fail(res,e);}}
