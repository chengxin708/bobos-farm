import { AlertTriangle } from 'lucide-react'

export default function TestingBanner() {
  return (
    <div className="shrink-0 bg-[#C4453A] text-white px-4 py-2.5 flex items-start sm:items-center justify-center gap-2.5 text-center">
      <AlertTriangle size={16} className="shrink-0 mt-0.5 sm:mt-0" />
      <p className="text-[13px] leading-snug font-medium">
        <span>网站测试中,请暂时不要付款</span>
        <span className="mx-2 opacity-60">·</span>
        <span>Site in testing — please do not make any payments yet</span>
      </p>
    </div>
  )
}
