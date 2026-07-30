import { PostrackLogo } from "@/components/brand/postrack-logo";
import { PostrackWordmark } from "@/components/brand/postrack-wordmark";

export function AuthBrandHeader() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <PostrackLogo size={72} priority />
      <PostrackWordmark size="xl" />
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground sm:text-base">
        Everything Your Business Needs,{" "}
        <span className="font-semibold text-primary">In One App!</span>
      </p>
    </div>
  );
}
