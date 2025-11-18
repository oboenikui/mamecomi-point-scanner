import React, { RefObject } from 'react'
import { CodeRegionInfo } from '../lib/MameComicScanner'

type ScannerViewProps = {
  videoRef: RefObject<HTMLVideoElement>
  canvasRef: RefObject<HTMLCanvasElement>
  isDebugMode: boolean
  codeRegion: CodeRegionInfo | null
  availableCameras: MediaDeviceInfo[]
  currentCameraId: string | null
  showCameraModal: boolean
  cameraInfo: string | null
  status: string
  scannedCode: string | null
  isScanning: boolean
  libraryError: string | null
  isScannerReady: boolean
  onStartScan: () => void
  onRescan: () => void
  onCopyToClipboard: () => Promise<void>
  onSwitchCamera: () => void
  onSelectCamera: (camera: MediaDeviceInfo) => void
  onCloseModal: () => void
}

const ScannerView: React.FC<ScannerViewProps> = ({
  videoRef,
  canvasRef,
  isDebugMode,
  codeRegion,
  availableCameras,
  currentCameraId,
  showCameraModal,
  cameraInfo,
  status,
  scannedCode,
  isScanning,
  libraryError,
  isScannerReady,
  onStartScan,
  onRescan,
  onCopyToClipboard,
  onSwitchCamera,
  onSelectCamera,
  onCloseModal,
}) => {
  return (
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
            onClick={onSwitchCamera}
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
            <button onClick={onStartScan} className="start-scan" disabled={!isScannerReady || !!libraryError}>
              スキャン開始
            </button>
          )}
          {scannedCode && (
            <button onClick={onRescan} className="rescan" disabled={!isScannerReady || !!libraryError}>
              再スキャン
            </button>
          )}
        </div>

        {showCameraModal && (
          <div className="modal" onClick={onCloseModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>カメラを選択</h3>
                <button onClick={onCloseModal} className="close-btn">
                  &times;
                </button>
              </div>
              <div className="modal-body">
                <div className="camera-list">
                  {availableCameras.map((camera) => (
                    <div
                      key={camera.deviceId}
                      className={`camera-option ${camera.deviceId === currentCameraId ? 'selected' : ''}`}
                      onClick={() => onSelectCamera(camera)}
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
              <button onClick={onCopyToClipboard} className="copy-button">
                登録ページを開く
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ScannerView
