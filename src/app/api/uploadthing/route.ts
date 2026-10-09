import {wrapAdmission} from '@/lib/security/admission-server';
import { createRouteHandler } from "uploadthing/next"
import { appFileRouter } from "./core"
const { GET: getHandler, POST: postHandler } = createRouteHandler({ router: appFileRouter })

export const GET=wrapAdmission(getHandler,'uploadthing-read'),POST=wrapAdmission(postHandler,'uploadthing-write',3000);
