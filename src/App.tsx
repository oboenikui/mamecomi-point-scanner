import { useEffect, useRef, useState } from 'react'
import LandingPage from './components/LandingPage'
import ScannerView from './components/ScannerView'
import { MameComicScanner, CodeRegionInfo } from './lib/MameComicScanner'
import './App.css'

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
        <LandingPage
          skipLandingNextTime={skipLandingNextTime}
          libraryStatusMessage={libraryStatusMessage}
          onToggleSkip={handleSkipLandingPreference}
          onEnterScan={handleEnterScanMode}
        />
      ) : (
        <ScannerView
          videoRef={videoRef}
          canvasRef={canvasRef}
          isDebugMode={isDebugMode}
          codeRegion={codeRegion}
          availableCameras={availableCameras}
          currentCameraId={currentCameraId}
          showCameraModal={showCameraModal}
          cameraInfo={cameraInfo}
          status={status}
          scannedCode={scannedCode}
          isScanning={isScanning}
          libraryError={libraryError}
          isScannerReady={isScannerReady}
          onStartScan={handleStartScan}
          onRescan={handleRescan}
          onCopyToClipboard={handleCopyToClipboard}
          onSwitchCamera={handleCameraSwitch}
          onSelectCamera={handleCameraSelect}
          onCloseModal={handleCloseModal}
        />
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
