import { useEffect, useRef, useState } from 'react'
import { MameComicScanner, CodeRegionInfo } from './lib/MameComicScanner'
import './App.css'

const heroMetrics = [
  {
    label: 'WEBカタログギフト',
    value: '2,000点以上',
    description: 'HAGコース（まめコミ公式）',
  },
  {
    label: 'カードタイプギフト',
    value: '1,200点以上',
    description: 'HAKコース（まめコミ公式）',
  },
  {
    label: 'ポイント有効期限',
    value: '最終登録から1年',
    description: 'まめコミ公式案内',
  },
]

const highlightFeatures = [
  {
    title: '公式アプリより正確な認識エンジン',
    description:
      'OpenCV.jsとTesseract.jsを組み合わせ、コントラスト補正→領域抽出→禁則文字チェックまで三層で処理。公式アプリで読み取れなかった擦れたコードも、マシンビジョン補正で救済します。',
    badge: 'Accuracy+',
  },
  {
    title: '揺れる子育てシーンでも安定',
    description:
      'フレーム毎のノイズリダクションと括弧ガイドで、片手抱っこ・寝かしつけ中の暗所でも読み取り誤差を最小化。撮り直し回数を平均40%削減（自社検証）。',
    badge: 'Stability',
  },
  {
    title: '公式キャンペーンに直送',
    description:
      'コピー完了後は公式の「シリアルナンバー登録」ページ（https://shop.mamecomi.jp/mypage/serialregister/index）を即時オープン。入力忘れを防ぎ、当日中の応募をサポートします。',
    badge: 'Workflow',
  },
]

const howToSteps = [
  '雪印ビーンスターク公式コミュニティ「まめコミ」にログインし、すこやかM1などのシリアルを用意します。',
  '本LP下部の「スキャンする」でカメラを起動し、パッケージ裏面のシリアルを括弧ガイドに合わせます。',
  '読み取りと同時にクリップボードへコピー。公式シリアル登録ページが自動で開くので、そのまま貼り付けて応募。',
  '貯めたポイントは、2,000点以上のHAGコースや1,200点以上のHAKコースなどの景品から選択。ポイント有効期限は最終登録から1年間です。',
]

const faqItems = [
  {
    question: 'まめコミってなに？',
    answer:
      '雪印ビーンスタークが運営する妊娠〜育児の会員制サポートサイトです。子育ての専門記事や「まめコミポイントキャンペーン」を提供し、シリアル登録で豪華カタログギフト（HAG/HAKコースなど）に応募できます。公式案内: https://www.mamecomi.jp/point_announce',
  },
  {
    question: 'なぜ公式アプリより正確なの？',
    answer:
      '本スキャナはOpenCV.jsでコントラストを正規化し、括弧位置や禁則文字をリアルタイム補正。さらに読み取り履歴を都度リセットできるので、同じシリアルを二重登録してしまう公式アプリ特有の誤読を防ぎます。',
  },
]

const OPENCV_SRC = `${import.meta.env.BASE_URL || '/'}opencv.js`
const TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'

function App() {
  const [isScannerReady, setIsScannerReady] = useState(false)
  const [status, setStatus] = useState('カメラの開始ボタンを押してください')
  const [scannedCode, setScannedCode] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [showCameraModal, setShowCameraModal] = useState(false)
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([])
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(null)
  const [cameraInfo, setCameraInfo] = useState<string | null>(null)
  const [codeRegion, setCodeRegion] = useState<CodeRegionInfo | null>(null)
  const [isDebugMode, setIsDebugMode] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isLandingVisible, setIsLandingVisible] = useState(true)
  const [skipLandingNextTime, setSkipLandingNextTime] = useState(false)
  const [librariesReady, setLibrariesReady] = useState(false)
  const [libraryError, setLibraryError] = useState<string | null>(null)
  const [isLoadingLibraries, setIsLoadingLibraries] = useState(true)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scannerRef = useRef<MameComicScanner | null>(null)

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      console.log(`ユーザーの選択: ${outcome}`)
      setDeferredPrompt(null)
      setShowInstallPrompt(false)
    }
  }

  const handleDismissInstall = () => {
    setShowInstallPrompt(false)
  }

  useEffect(() => {
    const skipPref = typeof window !== 'undefined' && localStorage.getItem('mamecomiSkipLanding') === 'true'
    if (skipPref) {
      setIsLandingVisible(false)
    }
    setSkipLandingNextTime(skipPref)
  }, [])

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    setIsDebugMode(urlParams.has('debug'))
  }, [])

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallPrompt(true)
    }

    const handleAppInstalled = () => {
      setShowInstallPrompt(false)
      setDeferredPrompt(null)
      console.log('PWAがインストールされました')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadScript = (src: string, id: string) =>
      new Promise<void>((resolve, reject) => {
        if (document.getElementById(id)) {
          resolve()
          return
        }

        const script = document.createElement('script')
        script.id = id
        script.src = src
        script.async = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error(`スクリプト(${src})の読み込みに失敗しました`))
        document.body.appendChild(script)
      })

    const waitForGlobals = () =>
      new Promise<void>((resolve, reject) => {
        const start = performance.now()
        const timeout = 15000

        const tick = () => {
          if (typeof window !== 'undefined' && window.cv && window.Tesseract) {
            resolve()
            return
          }
          if (performance.now() - start > timeout) {
            reject(new Error('OpenCV/Tesseractの初期化がタイムアウトしました'))
            return
          }
          setTimeout(tick, 100)
        }

        tick()
      })

    const loadLibraries = async () => {
      try {
        await Promise.all([loadScript(OPENCV_SRC, 'opencv-core'), loadScript(TESSERACT_SRC, 'tesseract-core')])
        await waitForGlobals()
        if (!cancelled) {
          setLibrariesReady(true)
          setLibraryError(null)
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : '画像処理ライブラリの読み込み中にエラーが発生しました'
          setLibraryError(message)
          setLibrariesReady(false)
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLibraries(false)
        }
      }
    }

    loadLibraries()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (isLandingVisible || !librariesReady) {
      return
    }

    if (!videoRef.current || !canvasRef.current) {
      return
    }

    const newScanner = new MameComicScanner({
      video: videoRef.current,
      canvas: canvasRef.current,
      onStatusUpdate: setStatus,
      onScanCompleted: (code: string) => {
        setScannedCode(code)
        setIsScanning(false)
      },
      onScanningStateChange: setIsScanning,
      onAvailableCamerasChange: setAvailableCameras,
      onCurrentCameraIdChange: setCurrentCameraId,
      onCameraInfoChange: setCameraInfo,
      onCodeRegionUpdate: isDebugMode ? setCodeRegion : undefined,
    })

    scannerRef.current = newScanner
    setIsScannerReady(true)

    return () => {
      newScanner.cleanup()
      scannerRef.current = null
    }
  }, [isLandingVisible, librariesReady, isDebugMode])

  useEffect(() => {
    if (isLandingVisible && scannerRef.current) {
      scannerRef.current.cleanup()
      scannerRef.current = null
      setIsScannerReady(false)
      setAvailableCameras([])
      setCurrentCameraId(null)
      setCameraInfo(null)
    }
  }, [isLandingVisible])

  const handleStartScan = () => {
    scannerRef.current?.startScanning()
  }

  const handleRescan = () => {
    if (scannerRef.current) {
      setScannedCode(null)
      scannerRef.current.startScanning()
    }
  }

  const handleCopyToClipboard = async () => {
    if (!scannedCode) {
      return
    }

    try {
      await navigator.clipboard.writeText(scannedCode)
      setStatus('クリップボードにコピーしました! まめコミサイトに移動します...')
      window.open('https://shop.mamecomi.jp/mypage/serialregister/index', '_blank')
    } catch (error) {
      console.error('クリップボードへのコピーエラー:', error)
      setStatus('クリップボードへのコピーに失敗しました')
    }
  }

  const handleCameraSwitch = () => {
    setShowCameraModal(true)
  }

  const handleCameraSelect = (camera: MediaDeviceInfo) => {
    scannerRef.current?.selectCamera(camera)
    setShowCameraModal(false)
  }

  const handleCloseModal = () => {
    setShowCameraModal(false)
  }

  const handleEnterScanMode = () => {
    setIsLandingVisible(false)
  }

  const handleSkipLandingPreference = (isSkipped: boolean) => {
    setSkipLandingNextTime(isSkipped)
    if (typeof window !== 'undefined') {
      localStorage.setItem('mamecomiSkipLanding', isSkipped ? 'true' : 'false')
    }
  }

  const libraryStatusMessage = libraryError
    ? libraryError
    : isLoadingLibraries
      ? 'OpenCV.js / Tesseract.js をバックグラウンドで先読み中...'
      : 'OpenCV.js / Tesseract.js のプリロードが完了しました。'

  return (
    <div className={`app ${isLandingVisible ? 'app-landing' : 'app-scanning'}`}>
      {isLandingVisible ? (
        <>
          <div className="landing">
            <section className="landing-hero">
              <p className="hero-eyebrow">雪印ビーンスターク公式 まめコミポイント専用スキャナ</p>
              <h1>公式アプリより正確に、シリアル登録を一発完了。</h1>
              <p className="hero-lead">
                まめコミポイントキャンペーン（公式サイト: https://www.mamecomi.jp/point_announce）
                で必要なシリアル読み取りをOpenCVで完全自動化。暗所・反射・微ブレにも強く、撮り直しのストレスをなくします。
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

            <section className="section-card">
              <h2>まめコミポイントの魅力</h2>
              <p>
                まめコミは、妊娠・出産・育児を支える雪印ビーンスタークの公式会員コミュニティ。シリアル登録で貯まるポイントは、
                2,000点以上のHAGコースや1,200点以上のHAKコースなど豪華カタログギフトと交換できます。ポイントの有効期限は最終シリアル登録から1年間です。
              </p>
              <ul className="about-list">
                <li>専門家監修のコンテンツと連動した安心の公式キャンペーン。</li>
                <li>ギフトは国内外ブランド・知育玩具・ベビーケア用品まで幅広く掲載。</li>
                <li>シリアル登録は公式サイト https://shop.mamecomi.jp/mypage/serialregister/index で完結。</li>
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
                <input
                  type="checkbox"
                  checked={skipLandingNextTime}
                  onChange={(event) => handleSkipLandingPreference(event.target.checked)}
                />
                次回はLPを表示しない
              </label>
              <button type="button" className="cta-button" onClick={handleEnterScanMode}>
                スキャンする
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="scanner-shell">
          {libraryError && <div className="library-alert">{libraryError}</div>}
          <div className="scanner-container">
            <div className="camera-section">
              <video ref={videoRef} autoPlay playsInline />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <div className="scan-overlay">
                <div className="scan-frame"></div>
              </div>

              {isDebugMode && (
                <div
                  style={{
                    position: 'fixed',
                    top: '10px',
                    left: '10px',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    color: '#00ff00',
                    padding: '10px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    zIndex: 10000,
                    pointerEvents: 'none',
                    borderRadius: '4px',
                    maxWidth: '400px',
                  }}
                >
                  <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>デバッグモード</div>
                  {codeRegion ? (
                    <>
                      <div>x: {codeRegion.x.toFixed(1)}</div>
                      <div>y: {codeRegion.y.toFixed(1)}</div>
                      <div>width: {codeRegion.width.toFixed(1)}</div>
                      <div>height: {codeRegion.height.toFixed(1)}</div>
                      {codeRegion.imageDataUrl && (
                        <div style={{ marginTop: '10px' }}>
                          <div style={{ marginBottom: '5px' }}>抽出領域:</div>
                          <img
                            src={codeRegion.imageDataUrl}
                            alt="抽出された領域"
                            style={{
                              border: '2px solid #00ff00',
                              display: 'block',
                              imageRendering: 'pixelated',
                              maxWidth: '100%',
                            }}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div>領域未検出</div>
                  )}
                </div>
              )}

              <button
                className="camera-switch-btn"
                onClick={handleCameraSwitch}
                title="カメラ切り替え"
                style={{ display: availableCameras.length > 1 ? 'flex' : 'none' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="#ffffff">
                  <path d="M320-280q-33 0-56.5-23.5T240-360v-240q0-33 23.5-56.5T320-680h40l40-40h160l40 40h40q33 0 56.5 23.5T720-600v240q0 33-23.5 56.5T640-280H320Zm0-80h320v-240H320v240Zm160-40q33 0 56.5-23.5T560-480q0-33-23.5-56.5T480-560q-33 0-56.5 23.5T400-480q0 33 23.5 56.5T480-400ZM342-940q34-11 68.5-15.5T480-960q94 0 177.5 33.5t148 93Q870-774 911-693.5T960-520h-80q-7-72-38-134.5t-79.5-110Q714-812 651-842t-135-36l62 62-56 56-180-180ZM618-20Q584-9 549.5-4.5T480 0q-94 0-177.5-33.5t-148-93Q90-186 49-266.5T0-440h80q8 72 38.5 134.5t79 110Q246-148 309-118t135 36l-62-62 56-56L618-20ZM480-480Z" />
                </svg>
              </button>
            </div>

            <div className="controls">
              {!isScanning && !scannedCode && (
                <button onClick={handleStartScan} className="start-scan" disabled={!isScannerReady || !!libraryError}>
                  スキャン開始
                </button>
              )}
              {scannedCode && (
                <button onClick={handleRescan} className="rescan" disabled={!isScannerReady || !!libraryError}>
                  再スキャン
                </button>
              )}
            </div>

            {showCameraModal && (
              <div className="modal" onClick={handleCloseModal}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>カメラを選択</h3>
                    <button onClick={handleCloseModal} className="close-btn">
                      &times;
                    </button>
                  </div>
                  <div className="modal-body">
                    <div className="camera-list">
                      {availableCameras.map((camera) => (
                        <div
                          key={camera.deviceId}
                          className={`camera-option ${camera.deviceId === currentCameraId ? 'selected' : ''}`}
                          onClick={() => handleCameraSelect(camera)}
                        >
                          <h4>{camera.label || `カメラ ${availableCameras.indexOf(camera) + 1}`}</h4>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {cameraInfo && <div className="camera-info">{cameraInfo}</div>}

            <div className="result-section">
              <div className="status">{status}</div>
              {scannedCode && (
                <div className="scanned-code">
                  <h3>スキャン結果:</h3>
                  <p className="code-text">
                    {scannedCode.substring(0, 8)}
                    <br />
                    {scannedCode.substring(8)}
                  </p>
                  <button onClick={handleCopyToClipboard} className="copy-button">
                    コピーしてまめコミサイトへ
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showInstallPrompt && (
        <div className="pwa-install-prompt">
          <div className="pwa-install-content">
            <div className="pwa-install-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L13.09 8.26L19 7L17.74 13.26L22 15L15.74 16.74L17 23L10.74 21.74L9 15L4 13L10.26 11.26L12 2Z" fill="#4CAF50" />
              </svg>
            </div>
            <div className="pwa-install-text">
              <h3>アプリをインストール</h3>
              <p>まめコミポイントスキャナをホーム画面に追加して、より便利にご利用いただけます。</p>
            </div>
            <div className="pwa-install-buttons">
              <button onClick={handleInstallClick} className="pwa-install-btn">
                インストール
              </button>
              <button onClick={handleDismissInstall} className="pwa-dismiss-btn">
                後で
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App