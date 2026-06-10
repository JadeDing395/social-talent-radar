import { redirect } from "next/navigation";

/** 兼容 art-talent-radar 老路由 /radar → /scan(统一扫描页) */
export default function RadarRedirect() {
  redirect("/scan");
}
