/**
 * 页脚超大字标：整行白色 OPENBF6TRACKER，铺满底部但不贴边。
 * 纯静态渲染，不做粒子/动画，避免任何额外运行时开销。
 */
export default function FooterMegaWord() {
  return (
    <div className="footer-mega" aria-hidden="true">
      <div className="footer-mega-word">OPENBF6TRACKER</div>
    </div>
  );
}
