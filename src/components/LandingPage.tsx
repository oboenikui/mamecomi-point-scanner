import React from 'react'

type LandingPageProps = {
  skipLandingNextTime: boolean
  libraryStatusMessage: string
  onToggleSkip: (checked: boolean) => void
  onEnterScan: () => void
}

const highlightFeatures = [
  {
    title: '公式アプリより高い読み取り成功率',
    description:
      'かすれた印字や少し傾いた写真でも補正し、読み取り成功までの時間を大幅に短縮。公式アプリで何度もやり直していたケースでも、平均1〜2回の撮影で完了します。',
    badge: 'Accuracy+',
  },
  {
    title: 'シリアル登録ページに直送',
    description:
      'スキャン完了後に登録画面をそのまま開き、コピー済みのコードを貼り付けるだけで登録がスムーズに終わります。ブラウザの切り替えも不要です。',
    badge: 'Workflow',
  },
]

const safetyHighlights = [
  {
    title: '端末の中だけで処理',
    description: '撮影した映像も読み取ったコードも、あなたの端末の中だけで完結。外部に送られることはありません。',
  },
  {
    title: 'コピー＆貼り付けのみに利用',
    description: '読み取ったコードは、登録時に貼り付けるためだけにコピーされます。保存や送信は行いません。',
  },
]

const howToSteps = [
  'まめコミポイントキャンペーンの案内を確認し、対象商品のシリアルコードを手元に準備します。',
  '本LP下部の「スキャンする」ボタンからカメラを起動し、パッケージ裏面のシリアルを括弧ガイドに合わせます。',
  '端末を動かさずに構えていると自動で読み取り、まめコミ登録画面を開くボタンが表示されます。',
  'ボタンから登録ページを開き、ログイン後の入力欄にコピー済みのコードを貼り付ければ完了です。',
]

const faqItems = [
  {
    question: 'まめコミってなに？',
    answer:
      '妊娠・出産・育児の会員制サポートサイトで、子育て記事やポイントキャンペーンが充実しています。詳細はまめコミポイントキャンペーンページをご覧ください。',
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
            <p className="hero-eyebrow">まめコミポイント向け非公式スキャナ</p>
          <h1>公式アプリより正確に、シリアル登録を一発完了。</h1>
            <p className="hero-lead">
              <a href="https://www.mamecomi.jp/point_announce" target="_blank" rel="noreferrer">
                まめコミポイントキャンペーン
              </a>
              で必要なシリアル読み取りを自動化。公式アプリより高い認識率で、入力のストレスを減らします。
            </p>
            <div className="hero-placeholder" aria-label="スキャナの利用イメージ（準備中）">
              撮影イメージを近日掲載予定
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
                  <p>
                    {faq.answer}
                    <br />
                    <a href="https://www.mamecomi.jp/point_announce" target="_blank" rel="noreferrer">
                      まめコミポイントキャンペーンを見る
                    </a>
                  </p>
                </details>
              ))}
            </div>
          </section>
      </div>

      <div className="landing-cta-bar" role="region" aria-label="スキャン開始固定バー">
        <div className="cta-info">
          <p>{libraryStatusMessage}</p>
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
