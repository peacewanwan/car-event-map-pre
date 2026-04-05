import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '二輪四輪オフ会メーカー - 今いる場所・予定を共有｜2輪4輪オフマップ',
  description: '【車・バイク好きの合流ツール】大黒PAや箱根、道の駅など全国のスポットに今誰がいるか、次いつ行くかをチェック。ハンドル名と車種だけでゆるく繋がれる。',
}

export default function SpotsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
