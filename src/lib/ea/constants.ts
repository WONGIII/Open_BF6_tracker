// ============================================================
// EA 官方接口常量
//
// 说明：
// - GLACIER_PC_CLIENT secret 来自 initfs_Win32 的
//   BFOnline.Win32NucleusClientSecretProd（prod PC 块，2025-08-21 build）。
//   EA 换 build 后此值会失效，管理员可在后台覆盖。
// - JUNO_PC_CLIENT secret / PC_SIGN_KEY 是 EA App 桌面端公开常量。
// - 这些值只用于服务端换取 token，不会通过任何前端接口返回。
// ============================================================

export const EA_ACCOUNTS_ORIGIN = "https://accounts.ea.com";

export const DICE_GRPC_HOST = "bf6-mp-cgw.ops.dice.se:443";
export const DICE_TENANCY = "prod_default-prod_default-santiago-common";

export const EADP_GRPC_HOST = "gateway.grpc.ea.com:443";

export const GLACIER_CLIENT_ID = "GLACIER_PC_CLIENT";
export const JUNO_CLIENT_ID = "JUNO_PC_CLIENT";

/** prod PC 客户端 secret（initfs_Win32 → BFOnline.Win32NucleusClientSecretProd） */
export const DEFAULT_GLACIER_CLIENT_SECRET = process.env.EA_GLACIER_CLIENT_SECRET
  || "wWi6TBw3hzdoV2v5cs5U9vcW6cWIiunW0AbdUGwMLzp7zmfJeXiGfe2vZMXitLbGq_20250821150105";

/** EA App 桌面端 JUNO 客户端 secret（公开常量） */
export const JUNO_CLIENT_SECRET = "4mRLtYMb6vq9qglomWEaT4ChxsXWcyqbQpuBNfMPOYOiDmYYQmjuaBsF2Zp0RyVeWkfqhE9TuGgAw7te";

/** EA App pc_sign 签名 key（公开常量） */
export const PC_SIGN_KEY = "ISa3dpGOc8wW7Adn4auACSQmaccrOyR2";

export const GLACIER_REDIRECT_URI = "http://127.0.0.1/success";
export const JUNO_REDIRECT_URI = "qrc:///html/login_successful.html";

export const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36";
export const EAAPP_UA = "EAApp/13.0 (Windows)";
export const ORIGIN_DM_UA = "Mozilla/5.0 EA Download Manager Origin/10.6.0.00000";

/** BF6 PC 平台码（viaJWT / getStats 实测值） */
export const PLATFORM_PC = 7;

/** gRPC 方法 */
export const METHODS = {
  viaJWT: "/santiago.client.authentication.ClientAuthentication/viaJWT",
  getStats: "/santiago.client.stats.ClientStats/getStats",
  filteredServers: "/santiago.client.play.ClientPlay/GetFilteredGameServers",
  detailedServerV2: "/santiago.client.play.ClientPlay/GetDetailedServerInfoV2",
  searchPlayers: "/eadp.playersearch.grpc.search.v1.service.PlayerSearch/SearchPlayers",
} as const;
