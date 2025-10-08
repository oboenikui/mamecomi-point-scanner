// まめコミポイントスキャナ - React用クラス

export interface CodeRegionInfo {
  x: number
  y: number
  width: number
  height: number
  imageDataUrl?: string
}

export interface ScannerConfig {
  video: HTMLVideoElement
  canvas: HTMLCanvasElement
  onStatusUpdate: (status: string) => void
  onScanCompleted: (code: string) => void
  onScanningStateChange: (isScanning: boolean) => void
  onAvailableCamerasChange: (cameras: MediaDeviceInfo[]) => void
  onCurrentCameraIdChange: (cameraId: string | null) => void
  onCameraInfoChange: (info: string | null) => void
  onCodeRegionUpdate?: (region: CodeRegionInfo | null) => void
}

export class MameComicScanner {
  private video: HTMLVideoElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  private stream: MediaStream | null = null
  private opencvReady = false
  private tesseractWorker: any = null
  private scanningInterval: number | null = null

  private state: 'waiting' | 'scanning' | 'completed' = 'waiting'

  private currentDeviceId: string | null = null
  private availableCameras: MediaDeviceInfo[] = []

  // コールバック関数
  private onStatusUpdate: (status: string) => void
  private onScanCompleted: (code: string) => void
  private onScanningStateChange: (isScanning: boolean) => void
  private onAvailableCamerasChange: (cameras: MediaDeviceInfo[]) => void
  private onCurrentCameraIdChange: (cameraId: string | null) => void
  private onCameraInfoChange: (info: string | null) => void
  private onCodeRegionUpdate?: (region: CodeRegionInfo | null) => void

  constructor(config: ScannerConfig) {
    this.video = config.video
    this.canvas = config.canvas
    this.ctx = this.canvas.getContext('2d')!

    this.onStatusUpdate = config.onStatusUpdate
    this.onScanCompleted = config.onScanCompleted
    this.onScanningStateChange = config.onScanningStateChange
    this.onAvailableCamerasChange = config.onAvailableCamerasChange
    this.onCurrentCameraIdChange = config.onCurrentCameraIdChange
    this.onCameraInfoChange = config.onCameraInfoChange
    this.onCodeRegionUpdate = config.onCodeRegionUpdate

    this.initializeResizeHandler()
    this.waitForOpenCV()
  }

  private waitForOpenCV() {
    this.updateStatus('ライブラリを読み込み中...')

    const checkLibraries = () => {
      const opencvReady = typeof window.cv !== 'undefined'
      const tesseractReady = typeof window.Tesseract !== 'undefined'

      if (opencvReady && tesseractReady) {
        this.onLibrariesReady()
      } else {
        setTimeout(checkLibraries, 100)
      }
    }

    checkLibraries()
  }

  private async onLibrariesReady() {
    this.opencvReady = true

    try {
      this.updateStatus('OCRエンジンを初期化中...')
      this.tesseractWorker = await window.Tesseract.createWorker()

      await this.tesseractWorker.loadLanguage('eng')
      await this.tesseractWorker.initialize('eng')

      await this.tesseractWorker.setParameters({
        tessedit_char_whitelist: 'ACEFGHJKLMNPRTWXY0123456789',
        tessedit_pageseg_mode: window.Tesseract.PSM.AUTO,
        tessedit_ocr_engine_mode: window.Tesseract.OEM.LSTM_ONLY,
      })

      this.updateStatus('準備完了: スキャンを開始してください')
      console.log('ライブラリが正常に読み込まれました')

    } catch (error) {
      console.error('OCRエンジンの初期化エラー:', error)
      this.updateStatus('OCRエンジンの初期化に失敗しました')
    }
  }

  async enumerateCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      this.availableCameras = devices.filter(device => device.kind === 'videoinput')
      this.onAvailableCamerasChange(this.availableCameras)
      console.log(`${this.availableCameras.length}個のカメラを検出しました`)
    } catch (error) {
      console.error('カメラ列挙エラー:', error)
    }
  }

  async startScanning() {
    try {
      // 既存のスキャンを停止（再スキャン時のクリーンアップ）
      this.stopScanning()
      
      this.updateStatus('カメラにアクセス中...')
      this.setState('scanning')

      if (this.stream) {
        this.resumeCamera()
        this.beginContinuousScanning()
        return
      }

      const constraints = this.getCameraConstraints()

      this.stream = await navigator.mediaDevices.getUserMedia(constraints)
      this.video.srcObject = this.stream

      await this.enumerateCameras()

      if (!this.currentDeviceId) {
        const track = this.stream.getVideoTracks()[0]
        const settings = track.getSettings()
        this.currentDeviceId = settings.deviceId || null
        this.onCurrentCameraIdChange(this.currentDeviceId)

        const currentCamera = this.availableCameras.find(camera => camera.deviceId === this.currentDeviceId)
        if (currentCamera) {
          const cameraName = this.getCameraDisplayName(currentCamera)
          this.showCameraInfo(`使用中: ${cameraName}`)
        }
      }

      this.video.onloadedmetadata = () => {
        this.setupVideoDisplay()
        this.beginContinuousScanning()
      }

    } catch (error) {
      console.error('カメラのアクセスエラー:', error)
      this.updateStatus('カメラにアクセスできませんでした。ブラウザでカメラの許可を与えてください。')
      this.setState('waiting')
    }
  }

  async selectCamera(camera: MediaDeviceInfo) {
    try {
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop())
      }

      this.currentDeviceId = camera.deviceId
      this.onCurrentCameraIdChange(this.currentDeviceId)

      const constraints = this.getCameraConstraints()
      this.stream = await navigator.mediaDevices.getUserMedia(constraints)
      this.video.srcObject = this.stream

      this.video.onloadedmetadata = () => {
        this.setupVideoDisplay()
        if (this.state === 'scanning') {
          this.beginContinuousScanning()
        }
      }

    } catch (error) {
      console.error('カメラ選択エラー:', error)
      this.updateStatus('カメラの切り替えに失敗しました')
    }
  }

  private getCameraDisplayName(camera: MediaDeviceInfo): string {
    if (camera.label) {
      return camera.label
    }
    const index = this.availableCameras.indexOf(camera) + 1
    return `カメラ ${index}`
  }

  private getCameraConstraints() {
    const baseConstraints: MediaStreamConstraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'environment'
      } as any
    }

    if (this.currentDeviceId) {
      (baseConstraints.video as any).deviceId = { exact: this.currentDeviceId }
      delete (baseConstraints.video as any).facingMode
    }

    return baseConstraints
  }

  private beginContinuousScanning() {
    this.updateStatus('スキャン中... マーカーを枠内に合わせてください')

    this.scanningInterval = window.setInterval(() => {
      this.performScan()
    }, 100)
  }

  private stopScanning() {
    if (this.scanningInterval) {
      clearInterval(this.scanningInterval)
      this.scanningInterval = null
    }
  }

  private stopCamera() {
    this.stopScanning()

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }

    this.video.srcObject = null
  }

  async cleanup() {
    this.stopCamera()

    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate()
      this.tesseractWorker = null
    }
  }

  private setState(newState: 'waiting' | 'scanning' | 'completed') {
    this.state = newState
    this.onScanningStateChange(newState === 'scanning')
  }

  private updateStatus(message: string) {
    this.onStatusUpdate(message)
    console.log('ステータス:', message)
  }

  private showCameraInfo(message: string) {
    this.onCameraInfoChange(message)
  }

  private pauseCamera() {
    if (this.video && this.video.srcObject) {
      this.video.pause()
    }
  }

  private resumeCamera() {
    if (this.video && this.video.srcObject) {
      this.video.play()
    }
  }

  private setupVideoDisplay() {
    const videoWidth = this.video.videoWidth
    const videoHeight = this.video.videoHeight

    const squareSize = Math.min(videoWidth, videoHeight)
    const maxDisplaySize = Math.min(400, window.innerHeight * 0.5)
    const displaySize = Math.min(squareSize, maxDisplaySize)

    this.canvas.width = squareSize
    this.canvas.height = squareSize

    const sizeStr = displaySize + 'px'

    this.video.style.width = sizeStr
    this.video.style.height = sizeStr
    this.video.style.objectFit = 'cover'
    this.video.style.borderRadius = '12px'
    this.video.style.display = 'block'
    this.video.style.margin = '0 auto'

    this.canvas.style.width = sizeStr
    this.canvas.style.height = sizeStr
    this.canvas.style.display = 'none'

    this.cropOffsetX = (videoWidth - squareSize) / 2
    this.cropOffsetY = (videoHeight - squareSize) / 2

    console.log(`ビデオサイズ: ${videoWidth}x${videoHeight}`)
    console.log(`正方形サイズ: ${squareSize}x${squareSize}`)
    console.log(`表示サイズ: ${displaySize}x${displaySize}`)
  }

  private cropOffsetX = 0
  private cropOffsetY = 0

  private drawVideoToCanvas() {
    this.ctx.drawImage(
      this.video,
      this.cropOffsetX, this.cropOffsetY,
      this.canvas.width, this.canvas.height,
      0, 0,
      this.canvas.width, this.canvas.height
    )
  }

  private initializeResizeHandler() {
    let resizeTimeout: number
    const handleResize = () => {
      if (resizeTimeout) {
        window.clearTimeout(resizeTimeout)
      }
      resizeTimeout = window.setTimeout(() => {
        if (this.video && this.video.videoWidth > 0) {
          console.log('画面サイズが変更されました。ビデオ表示を再調整します。')
          this.setupVideoDisplay()
        }
      }, 250)
    }

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
  }

  // 元のscanner.jsの主要なメソッドを移植
  private async performScan() {
    if (!this.opencvReady || !this.tesseractWorker || this.state !== 'scanning') {
      return
    }

    try {
      this.drawVideoToCanvas()
      const { guideDetected, scannedText } = await this.processImageWithOpenCV()

      if (guideDetected) {
        if (scannedText && scannedText.trim()) {
          this.updateStatus('コードを検出しました。精度向上のため複数回読み取り中...')
          const finalCode = await this.performMultipleOCR()

          if (finalCode) {
            this.onScanCompleted(finalCode)
            this.stopScanning()
            this.pauseCamera()
            this.setState('completed')
            this.updateStatus('スキャン完了!')
          }
        } else {
          this.updateStatus('文字の認識中... そのまま動かさないでください。')
        }
      } else {
        this.updateStatus('スキャン中... マーカーを枠内に合わせてください')
      }

    } catch (error) {
      console.error('スキャンエラー:', error)
    }
  }

  private async processImageWithOpenCV(): Promise<{ guideDetected: boolean; scannedText: string | null }> {
    try {
      // キャンバスからOpenCV Matオブジェクトを作成
      const src = window.cv.imread(this.canvas)

      // ガイド検出を先に実行
      const guideDetection = this.detectGuideMarkers(src)

      if (!guideDetection.found) {
        // ガイドが検出できない場合
        src.delete()
        return {
          guideDetected: false,
          scannedText: null
        }
      }

      // スキャナーのフレーム領域を抽出（角度補正付き）
      const scanRegion = this.extractScanRegion(src, guideDetection)

      // 画像前処理でOCR精度を向上
      const preprocessed = this.preprocessForOCR(scanRegion)

      // デバッグ用に前処理済み画像を通知
      if (this.onCodeRegionUpdate && guideDetection && 'rect' in guideDetection) {
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = preprocessed.cols
        tempCanvas.height = preprocessed.rows
        window.cv.imshow(tempCanvas, preprocessed)
        const imageDataUrl = tempCanvas.toDataURL('image/png')

        const region: CodeRegionInfo = {
          x: (guideDetection as any).rect.x,
          y: (guideDetection as any).rect.y,
          width: (guideDetection as any).rect.width,
          height: (guideDetection as any).rect.height,
          imageDataUrl: imageDataUrl
        }
        this.onCodeRegionUpdate(region)
      }

      // OCR処理
      const scannedText = await this.performOCR(preprocessed)

      // メモリクリーンアップ
      src.delete()
      scanRegion.delete()
      preprocessed.delete()

      return {
        guideDetected: true,
        scannedText: scannedText
      }

    } catch (error) {
      console.error('OpenCV処理エラー:', error)
      return {
        guideDetected: false,
        scannedText: null
      }
    }
  }

  private extractScanRegion(src: any, guideDetection: any = null) {
    // ガイド検出結果が渡されていない場合は検出を実行
    if (!guideDetection) {
      guideDetection = this.detectGuideMarkers(src)
    }

    if (!guideDetection.found) {
      // ガイドが検出できない場合は従来の固定位置を使用
      console.log('ガイドマーカーが検出できません。固定位置を使用します。')
      // デバッグ用にnullを通知
      if (this.onCodeRegionUpdate) {
        this.onCodeRegionUpdate(null)
      }
      return this.extractFixedRegion(src)
    }

    console.log('ガイドマーカーを検出しました。角度補正を実行します。')

    // 角度補正を実行
    const correctedImage = this.correctAngle(src, guideDetection)

    // 補正後の画像全体をコード領域として抽出
    // extractCodeRegionFromCorrectedはcorrectedImageをそのまま返すので、
    // ここではdeleteせず、呼び出し元で削除される
    const codeRegion = this.extractCodeRegionFromCorrected(correctedImage)

    return codeRegion
  }

  private extractFixedRegion(src: any) {
    // 従来の固定位置抽出（フォールバック用）
    const centerX = Math.floor(src.cols / 2)
    const centerY = Math.floor(src.rows / 2)

    // スキャンフレームのサイズを基準に割合を計算
    const baseSize = 400
    const frameWidth = 132
    const frameHeight = 108

    // 画像サイズに対する割合を計算
    const widthRatio = frameWidth / baseSize * 1.2
    const heightRatio = frameHeight / baseSize * 1.2

    // 実際の切り取りサイズを計算
    const width = Math.floor(src.cols * widthRatio)
    const height = Math.floor(src.rows * heightRatio)

    const rect = new window.cv.Rect(
      centerX - width / 2,
      centerY - height / 2,
      width,
      height
    )

    return src.roi(rect)
  }

  private detectGuideMarkers(src: any) {
    const startTime = performance.now()
    const gray = new window.cv.Mat()
    const edges = new window.cv.Mat()
    const lines = new window.cv.Mat()

    // デバッグ用統計情報
    const stats: any = {
      frameSize: `${src.cols}x${src.rows}`,
      linesFound: 0,
      verticalLines: 0,
      mergedLines: 0,
      bracketPairs: 0,
      selectedBracket: false,
      guideDetected: false,
      processingTime: 0,
      detectedLines: [],
      mergedDetectedLines: [],
      bracketCandidates: [],
      selectedIndex: -1,
      scanRegion: null as any,
      error: null
    }

    try {
      // スキャンガイド範囲を定義（画面中央の限定領域）
      const centerX = src.cols / 2
      const centerY = src.rows / 2
      const scanWidth = 240  // スキャンエリアの幅（300→240に調整）
      const scanHeight = 200 // スキャンエリアの高さ（120→200に拡大）

      const scanRegion = {
        x: centerX - scanWidth / 2,
        y: centerY - scanHeight / 2,
        width: scanWidth,
        height: scanHeight
      }

      stats.scanRegion = scanRegion

      // スキャン領域のみを抽出
      const scanRect = new window.cv.Rect(scanRegion.x, scanRegion.y, scanRegion.width, scanRegion.height)
      const regionOfInterest = src.roi(scanRect)

      // グレースケール変換
      const roiGray = new window.cv.Mat()
      window.cv.cvtColor(regionOfInterest, roiGray, window.cv.COLOR_RGBA2GRAY)

      // エッジ検出（パラメータを最適化）
      window.cv.Canny(roiGray, edges, 50, 150)

      // ハフ線変換で直線を検出（線の検出精度を向上）
      window.cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 50, 100, 20)

      // メモリクリーンアップ
      regionOfInterest.delete()
      roiGray.delete()

      stats.linesFound = lines.rows

      const verticalLines: any[] = []

      // 垂直線を抽出（スキャン領域座標で）
      for (let i = 0; i < lines.rows; i++) {
        const line = lines.data32S.slice(i * 4, i * 4 + 4)
        const [x1, y1, x2, y2] = line

        // 線の角度を計算
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI
        const normalizedAngle = Math.abs(angle)

        // 垂直線の判定（±15度の範囲で精度を向上）
        if (normalizedAngle > 75 && normalizedAngle < 105) {
          const lineLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))

          // 80px以上の線分を対象（検出範囲を拡大）
          if (lineLength >= 80) {
            const centerX = (x1 + x2) / 2
            const centerY = (y1 + y2) / 2

            verticalLines.push({
              x1, y1, x2, y2,
              centerX, centerY,
              length: lineLength,
              angle: normalizedAngle,
              // 元画像座標系での位置も保存
              globalX1: x1 + scanRegion.x,
              globalY1: y1 + scanRegion.y,
              globalX2: x2 + scanRegion.x,
              globalY2: y2 + scanRegion.y,
              globalCenterX: centerX + scanRegion.x,
              globalCenterY: centerY + scanRegion.y
            })

            console.log(`垂直線 ${verticalLines.length}: 長さ=${lineLength.toFixed(1)}, 角度=${normalizedAngle.toFixed(1)}°, ローカル中心=(${centerX.toFixed(1)}, ${centerY.toFixed(1)})`)
          }
        }
      }

      stats.verticalLines = verticalLines.length
      stats.detectedLines = verticalLines

      // 近い線分をマージ
      const mergedLines = this.mergeCloseLines(verticalLines)
      stats.mergedLines = mergedLines.length
      stats.mergedDetectedLines = mergedLines

      console.log(`${verticalLines.length}本の垂直線を${mergedLines.length}本にマージしました`)

      // 括弧ペアを検出（マージされた線を使用）
      const bracketPairs: any[] = []

      console.log(`=== 括弧ペア検出開始: ${mergedLines.length}本のマージ済み線を処理 ===`)

      for (let i = 0; i < mergedLines.length - 1; i++) {
        for (let j = i + 1; j < mergedLines.length; j++) {
          const line1 = mergedLines[i]
          const line2 = mergedLines[j]

          console.log(`線ペア ${i}-${j}: 線1(${line1.centerX.toFixed(1)}, ${line1.centerY.toFixed(1)}, 長さ${line1.length.toFixed(1)}) vs 線2(${line2.centerX.toFixed(1)}, ${line2.centerY.toFixed(1)}, 長さ${line2.length.toFixed(1)})`)

          // 水平距離を計算
          const horizontalDistance = Math.abs(line2.centerX - line1.centerX)

          // 垂直位置の重複をチェック
          const minY1 = Math.min(line1.y1, line1.y2)
          const maxY1 = Math.max(line1.y1, line1.y2)
          const minY2 = Math.min(line2.y1, line2.y2)
          const maxY2 = Math.max(line2.y1, line2.y2)

          const verticalOverlap = Math.min(maxY1, maxY2) - Math.max(minY1, minY2)
          const overlapRatio = verticalOverlap / Math.min(line1.length, line2.length)

          console.log(`  水平距離: ${horizontalDistance.toFixed(1)}px, 垂直重複: ${verticalOverlap.toFixed(1)}px (重複率: ${(overlapRatio * 100).toFixed(1)}%)`)

          // 括弧ペアの条件（最適化）
          // 1. 適切な水平距離（40-200px：検出範囲を調整）
          // 2. 垂直位置が重複している（40%以上：精度を向上）
          // 3. 両方とも十分な長さ（60px以上：より明確な線を検出）
          const distanceOK = horizontalDistance > 40 && horizontalDistance < 200
          const overlapOK = overlapRatio > 0.4
          const lengthOK = line1.length > 60 && line2.length > 60

          console.log(`  条件チェック: 距離=${distanceOK ? 'OK' : 'NG'}(${horizontalDistance.toFixed(1)}/40-200), 重複=${overlapOK ? 'OK' : 'NG'}(${(overlapRatio * 100).toFixed(1)}%/40%), 長さ=${lengthOK ? 'OK' : 'NG'}(${line1.length.toFixed(1)},${line2.length.toFixed(1)}/60)`)

          if (distanceOK && overlapOK && lengthOK) {
            const leftLine = line1.centerX < line2.centerX ? line1 : line2
            const rightLine = line1.centerX < line2.centerX ? line2 : line1

            const bracketCenter = {
              x: (leftLine.globalCenterX + rightLine.globalCenterX) / 2,
              y: (leftLine.globalCenterY + rightLine.globalCenterY) / 2
            }

            bracketPairs.push({
              leftLine,
              rightLine,
              center: bracketCenter,
              width: horizontalDistance,
              height: Math.min(line1.length, line2.length),
              overlapRatio
            })

            console.log(`    ✓ 括弧ペア候補に追加: ${bracketPairs.length}番目 - 幅=${horizontalDistance.toFixed(1)}, 重複率=${(overlapRatio * 100).toFixed(1)}%`)
          } else {
            console.log(`    ✗ 括弧ペア条件を満たさず`)
          }
        }
      }

      console.log(`=== 括弧ペア検出結果: ${bracketPairs.length}個の候補が見つかりました ===`)

      stats.bracketPairs = bracketPairs.length
      stats.bracketCandidates = bracketPairs

      // 最適な括弧ペアを選択（画像中央に最も近い左右のペア）
      if (bracketPairs.length > 0) {
        const scanCenterX = scanRegion.x + scanRegion.width / 2

        let bestBracket = bracketPairs[0]
        let minCombinedDistance = Number.MAX_VALUE
        let bestIndex = 0

        for (let i = 0; i < bracketPairs.length; i++) {
          const bracket = bracketPairs[i]
          
          // 左線の中央からの距離と右線の中央からの距離を合計
          const leftDistance = Math.abs(bracket.leftLine.globalCenterX - scanCenterX)
          const rightDistance = Math.abs(bracket.rightLine.globalCenterX - scanCenterX)
          const combinedDistance = leftDistance + rightDistance

          console.log(`  括弧ペア ${i}: 左線距離=${leftDistance.toFixed(1)}, 右線距離=${rightDistance.toFixed(1)}, 合計=${combinedDistance.toFixed(1)}`)

          if (combinedDistance < minCombinedDistance) {
            minCombinedDistance = combinedDistance
            bestBracket = bracket
            bestIndex = i
          }
        }

        stats.selectedIndex = bestIndex
        stats.selectedBracket = true
        stats.guideDetected = true

        console.log(`最適な括弧ペアを選択: インデックス ${bestIndex}, 中央からの合計距離=${minCombinedDistance.toFixed(1)}`)

        // 括弧ペアから仮想的な矩形を構築（グローバル座標で）
        const virtualRect = {
          x: bestBracket.leftLine.globalCenterX - 10,
          y: Math.min(
            Math.min(bestBracket.leftLine.globalY1, bestBracket.leftLine.globalY2),
            Math.min(bestBracket.rightLine.globalY1, bestBracket.rightLine.globalY2)
          ),
          width: bestBracket.width + 20,
          height: bestBracket.height
        }

        // 仮想的な角点を生成（グローバル座標で）
        const virtualCorners = [
          { x: virtualRect.x, y: virtualRect.y }, // 左上
          { x: virtualRect.x + virtualRect.width, y: virtualRect.y }, // 右上
          { x: virtualRect.x + virtualRect.width, y: virtualRect.y + virtualRect.height }, // 右下
          { x: virtualRect.x, y: virtualRect.y + virtualRect.height } // 左下
        ]

        const result = {
          found: true,
          rect: virtualRect,
          corners: virtualCorners,
          bracket: bestBracket,
          contour: null // 括弧検出では輪郭は不要
        }

        stats.processingTime = performance.now() - startTime

        return result
      }

      console.log('適切な括弧ペアが見つかりませんでした')

      const result = { found: false }
      stats.processingTime = performance.now() - startTime

      return result

    } catch (error) {
      console.error('ガイド検出エラー:', error)
      stats.error = (error as Error).message
      stats.processingTime = performance.now() - startTime

      return { found: false }
    } finally {
      gray.delete()
      edges.delete()
      lines.delete()
    }
  }

  private mergeCloseLines(lines: any[]) {
    if (lines.length <= 1) return lines

    const merged = []
    const used = new Array(lines.length).fill(false)

    for (let i = 0; i < lines.length; i++) {
      if (used[i]) continue

      let currentLine = lines[i]
      used[i] = true

      // 近い線分を探してマージ
      for (let j = i + 1; j < lines.length; j++) {
        if (used[j]) continue

        const otherLine = lines[j]
        const distance = Math.abs(otherLine.centerX - currentLine.centerX)

        // 20px以内の線分をマージ
        if (distance < 20) {
          // 線分をマージ（長い方を採用）
          if (otherLine.length > currentLine.length) {
            currentLine = otherLine
          }
          used[j] = true
        }
      }

      merged.push(currentLine)
    }

    return merged
  }

  private correctAngle(src: any, guideDetection: any) {
    const { corners } = guideDetection

    // 透視変換用の座標を設定
    const srcPoints = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, [
      corners[0].x, corners[0].y,  // 左上
      corners[1].x, corners[1].y,  // 右上
      corners[2].x, corners[2].y,  // 右下
      corners[3].x, corners[3].y   // 左下
    ])

    // 補正後の矩形サイズを計算
    const width = Math.max(
      Math.sqrt(Math.pow(corners[1].x - corners[0].x, 2) + Math.pow(corners[1].y - corners[0].y, 2)),
      Math.sqrt(Math.pow(corners[2].x - corners[3].x, 2) + Math.pow(corners[2].y - corners[3].y, 2))
    )

    const height = Math.max(
      Math.sqrt(Math.pow(corners[3].x - corners[0].x, 2) + Math.pow(corners[3].y - corners[0].y, 2)),
      Math.sqrt(Math.pow(corners[2].x - corners[1].x, 2) + Math.pow(corners[2].y - corners[1].y, 2))
    )

    // 目標座標（正方形に補正）
    const dstPoints = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, [
      0, 0,
      width, 0,
      width, height,
      0, height
    ])

    // 透視変換行列を計算
    const transform = window.cv.getPerspectiveTransform(srcPoints, dstPoints)

    // 変換を適用
    const corrected = new window.cv.Mat()
    const dsize = new window.cv.Size(width, height)
    window.cv.warpPerspective(src, corrected, transform, dsize)

    // メモリクリーンアップ
    srcPoints.delete()
    dstPoints.delete()
    transform.delete()

    // contourがnullでない場合のみdelete
    if (guideDetection.contour) {
      guideDetection.contour.delete()
    }

    return corrected
  }

  private extractCodeRegionFromCorrected(correctedImage: any) {
    // 補正済み画像全体をコード領域として使用
    // correctedImageは既に検出した括弧の線分に囲われた領域全体が透視変換されたもの
    
    // 補正済み画像全体をそのまま返す（部分的な切り取りはしない）
    return correctedImage
  }

  private preprocessForOCR(src: any) {
    const stretched = new window.cv.Mat()
    const gray = new window.cv.Mat()
    const binary = new window.cv.Mat()
    const processed = new window.cv.Mat()

    // 横方向に伸ばす処理（潰れた文字を補正するため）
    // 横方向に1.05倍、縦方向はそのまま
    const stretchScale = 1.05
    const newWidth = Math.round(src.cols * stretchScale)
    const newHeight = src.rows
    const dsize = new window.cv.Size(newWidth, newHeight)
    window.cv.resize(src, stretched, dsize, 0, 0, window.cv.INTER_CUBIC)

    // グレースケールに変換
    window.cv.cvtColor(stretched, gray, window.cv.COLOR_RGBA2GRAY)

    // ガウシアンブラーでノイズ除去（カーネルサイズを5x5に拡大）
    const kernelSize = new window.cv.Size(3, 3)
    window.cv.GaussianBlur(gray, gray, kernelSize, 0)

    // 適応的二値化でコントラストを強調（パラメータを最適化）
    window.cv.adaptiveThreshold(
      gray,
      binary,
      255,
      window.cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      window.cv.THRESH_BINARY,
      11,
      5
    )

    // モルフォロジー処理で文字を鮮明化（カーネルサイズを拡大）
    const kernel = window.cv.getStructuringElement(
      window.cv.MORPH_RECT,
      new window.cv.Size(3, 3)  // 2x2から3x3に拡大
    )
    window.cv.morphologyEx(gray, processed, window.cv.MORPH_CLOSE, kernel)

    // メモリクリーンアップ
    stretched.delete()
    gray.delete()
    binary.delete()
    kernel.delete()

    return processed
  }

  private async performOCR(processedImage: any): Promise<string | null> {
    try {
      // OpenCV MatをCanvasに描画
      const tempCanvas = document.createElement('canvas')
      window.cv.imshow(tempCanvas, processedImage)

      // Tesseract.jsでOCR実行
      const { data: { text } } = await this.tesseractWorker.recognize(tempCanvas)
      console.log('OCR結果:', text)

      // 結果を検証・整形
      const formattedCode = this.validateAndFormatCode(text)

      return formattedCode

    } catch (error) {
      console.error('OCR実行エラー:', error)
      return null
    }
  }

  private validateAndFormatCode(rawText: string): string | null {
    if (!rawText) return null

    // 改行、スペース、特殊文字を除去
    const cleanText = rawText.replace(/[\s\n\r]/g, '')

    // 括弧で囲まれた16文字のパターンを検索
    const bracketPattern = /\[([ACEFGHJKLMNPRTWXY0123456789]{16})\]/
    const match = cleanText.match(bracketPattern)

    if (match) {
      const code = match[1]
      if (this.isValidCode(code)) {
        return code
      }
    }

    // より柔軟なパターンマッチング（括弧が認識されない場合）
    const flexiblePattern = /([ACEFGHJKLMNPRTWXY0123456789]{16})/
    const flexibleMatch = cleanText.match(flexiblePattern)

    if (flexibleMatch) {
      const code = flexibleMatch[1]
      if (this.isValidCode(code)) {
        return code
      }
    }

    return null
  }

  private async performMultipleOCR(): Promise<string | null> {
    const targetSuccessCount = 6
    const scanResults: string[] = []
    let attempts = 0
    const maxAttempts = 100 // 無限ループを防ぐための上限

    try {
      // targetSuccessCount回成功するまで繰り返し
      while (scanResults.length < targetSuccessCount && attempts < maxAttempts) {
        attempts++

        // 少し待機してフレームを変える
        await new Promise(resolve => setTimeout(resolve, 50))

        // 最新フレームを取得
        this.drawVideoToCanvas()

        const result = await this.processImageWithOpenCV()

        // 有効な16文字のコードの場合のみ成功カウントに追加
        if (result.guideDetected && result.scannedText && this.isValidCode(result.scannedText)) {
          scanResults.push(result.scannedText)
          console.log(`有効スキャン ${scanResults.length}/${targetSuccessCount}: ${result.scannedText}`)
        }
      }

      if (scanResults.length < targetSuccessCount) {
        console.log(`最大試行回数に到達。成功回数: ${scanResults.length}/${targetSuccessCount}`)
        return null
      }

      console.log(`${targetSuccessCount}回の有効スキャンが完了。結果を統合中...`)

      // 成功したtargetSuccessCount回の結果から最も信頼性の高いコードを決定
      const finalCode = this.determineMostLikelyCode(scanResults)
      return finalCode

    } catch (error) {
      console.error('複数回OCRエラー:', error)
      return null
    }
  }

  private determineMostLikelyCode(scanResults: string[]): string | null {
    if (!scanResults || scanResults.length === 0) {
      return null
    }

    console.log(`${scanResults.length}個の有効な結果から最適なコードを算出中...`)

    // 16文字の位置ごとに文字の出現回数をカウント
    const characterCounts = Array(16).fill(null).map(() => ({} as Record<string, number>))

    for (const code of scanResults) {
      // ここに来る時点で既にisValidCodeでチェック済み
      for (let i = 0; i < 16; i++) {
        const char = code[i]
        characterCounts[i][char] = (characterCounts[i][char] || 0) + 1
      }
    }

    // 誤認識されやすい文字ペアの定義
    // [正しい文字, 誤認識される文字, 閾値（このペアの合計出現率がこの値以上なら補正適用）]
    // 閾値は誤認識率に基づいて設定（誤認識率が高いほど閾値を高く設定）
    const confusionPairs: Array<[string, string, number]> = [
      ['7', 'T', 0.25],
      ['M', 'H', 0.25],
      ['9', 'Y', 0.25],
      ['P', 'E', 0.25],
      ['4', 'A', 0.15]
    ]

    // 各位置で最も多く出現した文字を選択し、統計情報も出力
    let finalCode = ''
    for (let i = 0; i < 16; i++) {
      const counts = characterCounts[i]

      if (Object.keys(counts).length === 0) {
        console.error(`位置 ${i} に有効な文字がありません`)
        return null
      }

      let selectedChar = ''
      
      // 誤認識パターンのチェック
      let correctionApplied = false
      for (const [correctChar, confusedChar, threshold] of confusionPairs) {
        const correctCount = counts[correctChar] || 0
        const confusedCount = counts[confusedChar] || 0
        const totalPairCount = correctCount + confusedCount

        // この2文字のペアが設定された閾値以上を占める場合
        const pairRatio = totalPairCount / scanResults.length
        if (totalPairCount / scanResults.length >= 0.9 && correctCount / totalPairCount >= threshold) {
          // 正しい方の文字を採用
          selectedChar = correctChar
          correctionApplied = true
          
          const pairPercentage = (pairRatio * 100).toFixed(1)
          const thresholdPercentage = (threshold * 100).toFixed(0)
          console.log(`位置 ${i}: '${selectedChar}' (誤認識補正: ${correctChar}=${correctCount}回, ${confusedChar}=${confusedCount}回, 合計${pairPercentage}% ≥ 閾値${thresholdPercentage}% → ${correctChar}を採用)`)
          break
        }
      }

      // 誤認識パターンが適用されなかった場合、最も多く出現した文字を取得
      if (!correctionApplied) {
        selectedChar = Object.keys(counts).reduce((a, b) =>
          counts[a] > counts[b] ? a : b
        )

        const maxCount = counts[selectedChar]
        const confidence = (maxCount / scanResults.length * 100).toFixed(1)

        console.log(`位置 ${i}: '${selectedChar}' (${maxCount}/${scanResults.length}回, ${confidence}%)`)
      }

      finalCode += selectedChar
    }

    console.log(`最終統合結果: ${finalCode}`)

    // 最終的なコードの検証（念のため）
    if (this.isValidCode(finalCode)) {
      return finalCode
    }

    console.error('統合結果が無効なコードです')
    return null
  }

  private isValidCode(code: string): boolean {
    if (!code || code.length !== 16) {
      return false
    }

    // 禁止文字（B、D、I、O、Q、S、U、V、Z）が含まれていないかチェック
    const forbiddenChars = /[BDIOQSUVZ]/
    if (forbiddenChars.test(code)) {
      return false
    }

    // 許可された文字のみで構成されているかチェック
    const allowedChars = /^[ACEFGHJKLMNPRTWXY0123456789]+$/
    return allowedChars.test(code)
  }
}

// グローバル型定義
declare global {
  interface Window {
    cv: any
    Tesseract: any
  }
} 