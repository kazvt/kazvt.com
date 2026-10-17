import { layoutSideEdgeDecals } from "./decal-layout.mjs";

export const REWARD_DECAL_COUNT = 8;

export const REWARD_DECAL_POOL = Object.freeze([
  { className: "wall-art--treasure", src: "/reward/retro/treasure-chest.gif" },
  { className: "wall-art--treasure-two", src: "/reward/retro/treasure-chest-2.gif" },
  { className: "wall-art--winner", src: "/reward/retro/winner-trophy.gif" },
  { className: "wall-art--coin", src: "/reward/retro/coin.gif" },
  { className: "wall-art--wow", src: "/reward/retro/wow.gif" },
  { className: "wall-art--genie", src: "/reward/retro/genie.gif" },
  { className: "wall-art--dance", src: "/reward/retro/dance.gif" },
  { className: "wall-art--dance", src: "/reward/retro/dancegif_bgless.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/672ZLW3ZRJMOYJ4OFMF4VOTN45WFA5VL.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/4EASXRX3RXVFSOJ2LFAAZVS5UBJNBUDK.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/5WOBIMHHI4H4MOTZFEVPGSPX3736YZIB.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/2GK7VZEDC3PBZQHWBW6EG2ZJRKGQGXHF.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/47HCI5YW4NWAF525T6JWDJIFWP2Q6YQI.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/5JDWSAI54RPIK6BCPU2H2NBNRSZGYPHG.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/S26NLT5BWSSFORL47PWERRTJYJWTI5HG.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/CFPCERSUU6364GA5WKQ4VFANJDX6NWFN.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/XJTX2PSXZKTJCICMCQBYFGQE4MGQWENE.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/NSBFCIDINGXX4VCNY4IDDQ2NMEEXVWZO.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/ADCAG6ZIOATCVEYDTGKY53UG7YYBFAJL.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/OXECAQJANJTONZH5YZGUCQNI5RLG5V3H.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/XNGSAHS33LSB3XDUABX4MCBZCS7MBUZJ.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/YL2DWY3Z4PPCQTE7M6DNWH6ATUD2TMCJ.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/ZXNCAPTXBD2RESIH755PZBS5YY4BUBXN.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/4LMN4ZMXR76B2RZAD72CBVBUMBXP5JU5.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/YEM2WX5XR5WLHL6UW4EVJICAJODRLNBS.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/FLSMZE3SFDZIHULNZALXACRCAF57JVVA.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/43YV66AQEFBP6WF273WMUEIHJ4NJRT4K.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/4V6X7B5WWZ277UDU6WWB4H7U5VZ3OROG.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/LEOF3CYEHZIHBJVNXAIK55WVWHKFROLJ.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/TXAPCKNHMK6SG4L4YFVR3OI7WC7HW44S.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/ZORRWJ2VI345STZPZMDRZVDMWISTNSY5.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/2EWWLIKTG25LMDGPQBTBKJ3KDPS5XHYF.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/2IZG7SWC2PK5IFX3EAGXHCQY3VL2OY33.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/E56Z5Y2WLCDWJQSK6LF2W5BF5NXU5YTK.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/awaw.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/WNYOPWW72P424UFMBK7YTD76GSFCYYIL.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/FBGT46XS26DXXLHDMCMRVDDC2TSOLQAI.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/2VBUC5NDWI6QMGUWJX3XCYCWXJITQDLH.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/X44WKTDGAOIUNJTYUA6QFW7UNYERP2IL.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/AOG6PKL6EYMK6SY3LZVFXA7IQHOUBMT3.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/ODVIVM7XC3MHWV6UMRPW5FJHGNLMBCVX.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/MJSK3HHDJAKCSRWK6WFB2CTQBMNLF6EH.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/VFOMW7LJXXY534ZXPL73IZOWBASEHDRO.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/76KDPRPJTC2RPFNJQNWIC3DYJOSEGY6A.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/KVVPLKC65H4F3QCBOM36TUBRRNY6JKZ4.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/BUQBR72DLPCGW5VIQ2SKVETXJWDKTTVK.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/E4GCKQOB6RREK3XRR4JRLVBQJMIFFUPL.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/5WYNWBI4FTDDCAKHJLL3EJJE62YOR4BT.gif" },
  { className: "wall-art--dance", src: "/reward/retro/decal-pool/dancey_bgless.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/6LZJ4O72Z4MXOR4V3KSPRPU4JQJZ6WFP_bgless.gif" },
  { className: "wall-art--decal-pool", src: "/reward/retro/decal-pool/6CUDHAUOFHOUFTI53VESZXBAVP7KVU63_bgless.gif" },
  {
    className: "wall-art--decal-pool",
    side: "left",
    src: "/reward/retro/decal-pool/AJ3PGGLROVFZ4RADSQHDTT6ILHCMIGVD_repaired.gif"
  },
  {
    className: "wall-art--decal-pool",
    side: "right",
    src: "/reward/retro/decal-pool/FZOIT4NKHYKHZELQATMJIGYUJM3VUZ45.gif"
  },
  {
    className: "wall-art--decal-pool",
    side: "left",
    src: "/reward/retro/decal-pool/S4PFGWRLGB34WVSA3KRJ6US45232D3EU.gif"
  },
  {
    className: "wall-art--decal-pool",
    side: "right",
    src: "/reward/retro/decal-pool/WLDLDJVKFZKRH5VLQSGZM4EPB7TN6MEC.gif"
  },
  {
    className: "wall-art--decal-pool",
    side: "left",
    src: "/reward/retro/decal-pool/CWKDK64M4KFOKNEK5244P52V57DJGDPL.gif"
  },
  {
    className: "wall-art--decal-pool",
    src: "/reward/retro/decal-pool/DFKBEM3QMD4SYQEUYGRXVNNZLPUJX5AO.gif"
  },
  {
    className: "wall-art--decal-pool",
    src: "/reward/retro/decal-pool/AMLVTNU2URJXNELKRPSKE7NTY5VTTA4E.gif"
  },
  {
    className: "wall-art--decal-pool",
    side: "right",
    src: "/reward/retro/decal-pool/FAY72EKBPY2XQ7TG6DXLZASSTYAT3HR6.gif"
  },
  {
    className: "wall-art--decal-pool",
    src: "/reward/retro/decal-pool/ROSN2WTVW2U2AUQKM5JYHT2JAHTA7S22.gif"
  },
  {
    className: "wall-art--decal-pool",
    src: "/reward/retro/decal-pool/PIUMSHKA5VQRPNYL5YA523BW7BVVF7IE.gif"
  }
]);

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromAssetHash(assetHash, purpose) {
  const identity = `reward-edge-decals-v1\u0000${purpose}\u0000${assetHash.toLowerCase()}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < identity.length; index += 1) {
    hash = Math.imul(hash ^ identity.charCodeAt(index), 0x01000193);
  }
  return (hash >>> 0) || 1;
}

export function selectRewardEdgeDecals(assetHash, width, height) {
  if (typeof assetHash !== "string" || !/^[a-f0-9]{64}$/i.test(assetHash)) return [];

  const positions = layoutSideEdgeDecals(
    width,
    height,
    REWARD_DECAL_COUNT,
    seedFromAssetHash(assetHash, "positions")
  );
  if (positions.length !== REWARD_DECAL_COUNT) return [];

  const random = createSeededRandom(seedFromAssetHash(assetHash, "pool"));
  const available = [...REWARD_DECAL_POOL];

  return positions.map(position => {
    const eligible = available.filter(item => !item.side || item.side === position.side);
    if (eligible.length === 0) return null;

    const item = eligible[Math.floor(random() * eligible.length)];
    available.splice(available.indexOf(item), 1);
    return { item, position };
  }).filter(Boolean);
}
