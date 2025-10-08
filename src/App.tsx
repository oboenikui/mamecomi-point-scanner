import { useState, useEffect, useRef } from 'react'
import { MameComicScanner, CodeRegionInfo } from './lib/MameComicScanner'
import './App.css'

function App() {
  const [scanner, setScanner] = useState<MameComicScanner | null>(null)
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

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // PWAインストール関数
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
    // PWAインストールプロンプトの処理
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
    // クエリパラメータからデバッグモードをチェック
    const urlParams = new URLSearchParams(window.location.search)
    const debugParam = urlParams.has('debug')
    setIsDebugMode(debugParam)

    // スキャナーの初期化
    const initScanner = () => {
      if (videoRef.current && canvasRef.current) {
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
          onCodeRegionUpdate: debugParam ? setCodeRegion : undefined,
        })
        setScanner(newScanner)
      }
    }

    // OpenCVとTesseractの読み込み完了を待つ
    const checkLibraries = () => {
      if (typeof window.cv !== 'undefined' && typeof window.Tesseract !== 'undefined') {
        initScanner()
      } else {
        setTimeout(checkLibraries, 100)
      }
    }

    checkLibraries()

    // クリーンアップ
    return () => {
      if (scanner) {
        scanner.cleanup()
      }
    }
  }, [])

  const handleStartScan = () => {
    if (scanner) {
      scanner.startScanning()
    }
  }

  const handleRescan = () => {
    if (scanner) {
      setScannedCode(null)
      scanner.startScanning()
    }
  }

  const handleCopyToClipboard = async () => {
    if (scannedCode) {
      try {
        await navigator.clipboard.writeText(scannedCode)
        setStatus('クリップボードにコピーしました! まめコミサイトに移動します...')
        
        // 少し待ってからURLに移動
        window.open('https://shop.mamecomi.jp/mypage/serialregister/index', '_blank')
      } catch (error) {
        console.error('クリップボードへのコピーエラー:', error)
        setStatus('クリップボードへのコピーに失敗しました')
      }
    }
  }

  const handleCameraSwitch = () => {
    setShowCameraModal(true)
  }

  const handleCameraSelect = (camera: MediaDeviceInfo) => {
    if (scanner) {
      scanner.selectCamera(camera)
    }
    setShowCameraModal(false)
  }

  const handleCloseModal = () => {
    setShowCameraModal(false)
  }

  return (
    <div className="app">
      <header>
        <h1>まめコミポイントスキャナ</h1>
        <p>すこやかミルクのシリアルコードをスキャンしてクリップボードにコピーします</p>
      </header>

      <div className="scanner-container">
        <div className="camera-section">
          <video ref={videoRef} autoPlay playsInline />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <div className="scan-overlay">
            <div className="scan-frame"></div>
          </div>

          {/* デバッグモード用：座標情報と抽出画像の表示 */}
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

          {/* カメラ切り替えボタン（右下固定） */}
          <button
            className="camera-switch-btn"
            onClick={handleCameraSwitch}
            title="カメラ切り替え"
            style={{ display: availableCameras.length > 1 ? 'flex' : 'none' }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="48px"
              viewBox="0 -960 960 960"
              width="48px"
              fill="#ffffff"
            >
              <path d="M320-280q-33 0-56.5-23.5T240-360v-240q0-33 23.5-56.5T320-680h40l40-40h160l40 40h40q33 0 56.5 23.5T720-600v240q0 33-23.5 56.5T640-280H320Zm0-80h320v-240H320v240Zm160-40q33 0 56.5-23.5T560-480q0-33-23.5-56.5T480-560q-33 0-56.5 23.5T400-480q0 33 23.5 56.5T480-400ZM342-940q34-11 68.5-15.5T480-960q94 0 177.5 33.5t148 93Q870-774 911-693.5T960-520h-80q-7-72-38-134.5t-79.5-110Q714-812 651-842t-135-36l62 62-56 56-180-180ZM618-20Q584-9 549.5-4.5T480 0q-94 0-177.5-33.5t-148-93Q90-186 49-266.5T0-440h80q8 72 38.5 134.5t79 110Q246-148 309-118t135 36l-62-62 56-56L618-20ZM480-480Z" />
            </svg>
          </button>
        </div>

        <div className="controls">
          {!isScanning && !scannedCode && (
            <button onClick={handleStartScan} className="start-scan">
              スキャン開始
            </button>
          )}
          {scannedCode && (
            <button onClick={handleRescan} className="rescan">
              再スキャン
            </button>
          )}
        </div>

        {/* カメラ選択モーダル */}
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

        {cameraInfo && (
          <div className="camera-info">
            {cameraInfo}
          </div>
        )}

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

        {/* PWAインストールプロンプト */}
        {showInstallPrompt && (
          <div className="pwa-install-prompt">
            <div className="pwa-install-content">
              <div className="pwa-install-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L13.09 8.26L19 7L17.74 13.26L22 15L15.74 16.74L17 23L10.74 21.74L9 15L4 13L10.26 11.26L12 2Z" fill="#4CAF50"/>
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
    </div>
  )
}

export default App 