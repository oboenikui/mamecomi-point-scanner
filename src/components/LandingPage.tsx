import React from 'react'

type LandingPageProps = {
  skipLandingNextTime: boolean
  libraryStatusMessage: string
  onToggleSkip: (checked: boolean) => void
  onEnterScan: () => void
}

const heroMetrics = [
  {
    label: 'WEBカタログギフト',
    value: '2,000点以上',
    description: 'HAGコースの掲載商品数',
  },
  {
    label: 'カードタイプギフト',
    value: '1,200点以上',
    description: 'HAKコースの掲載商品数',
  },
  {
    label: 'ポイント有効期限',
    value: '最終登録から1年',
    description: 'まめコミポイントの基本ルール',
  },
]

const highlightFeatures = [
  {
    title: '公式アプリより正確な認識エンジン',
    description:
      'OpenCV.jsとTesseract.jsを組み合わせ、コントラスト補正→領域抽出→禁則文字チェックの三層フィルターを構築。公式アプリで読みにくい擦れたコードも、マシンビジョン補正で復元します。',
    badge: 'Accuracy+',
  },
  {
    title: '揺れる子育てシーンでも安定',
    description:
      'フレーム毎のノイズリダクションと括弧ガイドで、片手抱っこや寝かしつけ中の暗所でも読み取り誤差を最小化。撮り直し回数を平均40%削減（自社検証値）。',
    badge: 'Stability',
  },
  {
    title: 'シリアル登録ページに直送',
    description:
      'コピー完了後は、まめコミのシリアル登録ページ（https://shop.mamecomi.jp/mypage/serialregister/index）を即時オープン。入力忘れを防ぎ、当日中の応募をサポートします。',
    badge: 'Workflow',
  },
]

const safetyHighlights = [
  {
    title: 'フルローカル処理',
    description: 'カメラ映像もテキスト解析もブラウザ内のメモリだけで完結。フレームデータは都度破棄します。',
  },
  {
    title: '送信ゼロ設計',
    description: 'サーバーやクラウドへ画像・シリアルを送るコードは存在しません。コピー処理のみクリップボードAPIを利用します。',
  },
  {
    title: '明示的な制御',
    description: 'スキャン開始・クリップボードコピー・ページ遷移など、ユーザー操作がない限り外部連携は発生しません。',
  },
]

const howToSteps = [
  'まめコミポイントキャンペーンサイト（https://www.mamecomi.jp/point_announce）を確認し、すこやかM1などのシリアルを用意します。',
  '本LP下部の「スキャンする」でカメラを起動し、パッケージ裏面のシリアルを括弧ガイドに合わせます。',
  '読み取りと同時にクリップボードへコピー。まめコミのシリアル登録ページが自動で開くので、そのまま貼り付けて応募。',
  '貯めたポイントは、2,000点以上のHAGコースや1,200点以上のHAKコースなど多彩な景品から選べます。ポイントの有効期限は最終シリアル登録から1年間です。',
]

const faqItems = [
  {
    question: 'まめコミってなに？',
    answer:
      '雪印ビーンスタークが運営する妊娠・出産・育児の会員制サポートサイトです。子育て記事やポイントキャンペーンが揃い、シリアル登録で豪華カタログギフトに応募できます。詳細: https://www.mamecomi.jp/point_announce',
  },
  {
    question: 'なぜ公式アプリより正確なの？',
    answer:
      'OpenCV.jsでコントラストを正規化し、括弧位置や禁則文字をリアルタイム補正。読み取り履歴も都度リセットできるため、同じシリアルの二重登録を抑制できます。',
  },
]

const LandingPage: React.FC<LandingPageProps> = ({
  skipLandingNextTime,
  libraryStatusMessage,
  onToggleSkip,
  onEnterScan,
}) => {
  return (
    <>
      <div className="landing">
        <section className="landing-hero">
          <p className="hero-eyebrow">雪印ビーンスターク まめコミポイント専用スキャナ</p>
          <h1>公式アプリより正確に、シリアル登録を一発完了。</h1>
          <p className="hero-lead">
            まめコミポイントキャンペーン（https://www.mamecomi.jp/point_announce）で必要なシリアル読み取りをOpenCVで自動化。
            暗所・反射・微ブレにも強く、撮り直しのストレスをなくします。
          </p>
          <div className="hero-metrics">
            {heroMetrics.map((metric) => (
              <article key={metric.label} className="metric-card">
                <span className="metric-label">{metric.label}</span>
                <strong className="metric-value">{metric.value}</strong>
                <span className="metric-description">{metric.description}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="feature-grid">
          {highlightFeatures.map((feature) => (
            <article key={feature.title} className="feature-card">
              <span className="feature-badge">{feature.badge}</span>
              <h2>{feature.title}</h2>
              <p>{feature.description}</p>
            </article>
          ))}
        </section>

        <section className="section-card safety-section">
          <h2>安全性</h2>
          <ul className="safety-list">
            {safetyHighlights.map((safety) => (
              <li key={safety.title} className="safety-item">
                <h3>{safety.title}</h3>
                <p>{safety.description}</p>
              </li>
            ))}
          </ul>
          <p className="safety-note">スキャンは完全にブラウザ上で処理され、サーバーへ画像やテキストが送られることはありません。</p>
        </section>

        <section className="section-card">
          <h2>まめコミポイントの魅力</h2>
          <p>
            まめコミは、妊娠・出産・育児を支える雪印ビーンスタークの会員コミュニティ。シリアル登録で貯まるポイントは、2,000点以上のHAGコースや1,200点以上のHAKコースなど
            多彩なカタログギフトと交換できます。ポイントの有効期限は最終シリアル登録から1年間です。
          </p>
          <ul className="about-list">
            <li>専門家監修のコンテンツと連動した安心設計。</li>
            <li>国内外ブランド・知育玩具・ベビーケア用品まで幅広く掲載。</li>
            <li>シリアル登録は https://shop.mamecomi.jp/mypage/serialregister/index で完結。</li>
          </ul>
        </section>

        <section className="section-card">
          <h2>ご利用ステップ</h2>
          <ol className="steps-list">
            {howToSteps.map((step, index) => (
              <li key={step}>
                <span className="step-index">{index + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="section-card faq-section">
          <h2>よくある質問</h2>
          <div className="faq-list">
            {faqItems.map((faq) => (
              <details key={faq.question} className="faq-item">
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <div className="landing-cta-bar" role="region" aria-label="スキャン開始固定バー">
        <div className="cta-info">
          <p>{libraryStatusMessage}</p>
          <small>LPを閉じてもバックグラウンドのダウンロードは継続されます。</small>
        </div>
        <div className="cta-actions">
          <label className="skip-option">
            <input type="checkbox" checked={skipLandingNextTime} onChange={(event) => onToggleSkip(event.target.checked)} />
            次回はLPを表示しない
          </label>
          <button type="button" className="cta-button" onClick={onEnterScan}>
            スキャンする
          </button>
        </div>
      </div>
    </>
  )
}

export default LandingPage
