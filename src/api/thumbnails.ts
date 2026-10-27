import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo, type Video } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

// const videoThumbnails: Map<string, Thumbnail> = new Map();

// export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
//   const { videoId } = req.params as { videoId?: string };
//   if (!videoId) {
//     throw new BadRequestError("Invalid video ID");
//   }

//   const video = getVideo(cfg.db, videoId);
//   if (!video) {
//     throw new NotFoundError("Couldn't find video");
//   }

//   const thumbnail = videoThumbnails.get(videoId);
//   if (!thumbnail) {
//     throw new NotFoundError("Thumbnail not found");
//   }

//   return new Response(thumbnail.data, {
//     headers: {
//       "Content-Type": thumbnail.mediaType,
//       "Cache-Control": "no-store",
//     },
//   });
// }

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
  const imageBuffer = await imageData.arrayBuffer();
  const videoThumbnail: Thumbnail = {
    data: imageBuffer,
    mediaType: imageType
  }

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  if (video.userID != userID) {
    throw new UserForbiddenError("Not your video");
  }

  // videoThumbnails.set(videoId, videoThumbnail);

  const dataBuffer = Buffer.from(imageBuffer);
  const dataString = dataBuffer.toString("base64");

  const thumbnailUrl = `data:${imageType};base64,${dataString}`;
  const updatedVideo: Video = {...video, thumbnailURL: thumbnailUrl};
  updateVideo(cfg.db, updatedVideo);

  return respondWithJSON(200, updatedVideo);
}
