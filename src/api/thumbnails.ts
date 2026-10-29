import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo, type Video } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import path from "path";

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  const formData = await req.formData();
  const imageData = formData.get("thumbnail");
  if (!(imageData instanceof File)) {
    throw new BadRequestError("Thumbnail file missing");
  }

  const MAX_UPLOAD_SIZE = 10 << 20;
  if (imageData.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("File size greater than 10MB");
  }

  const imageType = imageData.type;
  const allowedTypes = ["image/jpeg", "image/png"];
  if (!allowedTypes.includes(imageType)) {
    throw new BadRequestError("image must be jpeg or png")
  }
  
  const imageBuffer = await imageData.arrayBuffer();

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  if (video.userID != userID) {
    throw new UserForbiddenError("Not your video");
  }

  const fileRoot = cfg.assetsRoot;
  const fileExt = imageType.split("/")[1];
  console.log(fileRoot);
  const fileName = path.format({
    root: "/",
    name: videoId,
    ext: fileExt
  });
  const filePath = path.join(fileRoot, fileName);
  await Bun.write(filePath, imageBuffer);

  const thumbnailUrl = `http://localhost:${cfg.port}/${filePath}`;
  const updatedVideo: Video = {...video, thumbnailURL: thumbnailUrl};
  updateVideo(cfg.db, updatedVideo);

  return respondWithJSON(200, updatedVideo);
}
