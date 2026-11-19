// Cloudflare Pages Functions 용 진입점 (Workers 는 worker/index.js 사용)
import { handleBinance } from "../../lib/api.js";

export const onRequestGet = ({ request }) => handleBinance(request);
