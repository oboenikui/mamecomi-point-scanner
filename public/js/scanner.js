/* eslint-env browser */
/* global setInterval, clearInterval, performance, URLSearchParams */

// まめコミポイントスキャナー - メインスクリプト

class MameComicScanner {
  constructor() {
    this.video = document.getElementById('video');
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // デバッグ用キャンバス
    this.debugCanvas = document.getElementById('debug-canvas');
    this.debugCtx = this.debugCanvas.getContext('2d');
    this.debugMode = false;
    this.stream = null;
    this.opencvReady = false;
    this.tesseractWorker = null;
    this.scanningInterval = null;
    
    // スキャナーの状態
    this.state = 'waiting'; // 'waiting', 'scanning', 'completed'
    this.lastScannedCode = null; // 最後にスキャンしたコード（改行なし）
    
    // カメラ関連
    this.currentDeviceId = null;
    this.availableCameras = [];
    
    // ボタン要素
    this.startScanButton = document.getElementById('start-scan');
    this.rescanButton = document.getElementById('rescan');
    this.copyButton = document.getElementById('copy-button');
    this.cameraSwitchButton = document.getElementById('camera-switch');
    this.closeModalButton = document.getElementById('close-modal');
    this.cameraModal = document.getElementById('camera-modal');
    this.cameraList = document.getElementById('camera-list');
    
    // ステータス表示
    this.statusElement = document.getElementById('status');
    this.scannedCodeElement = document.getElementById('scanned-code');
    this.codeTextElement = document.getElementById('code-text');
    this.cameraInfoElement = document.getElementById('camera-info');
    
    // デバッグ表示
    this.debugToggleButton = document.getElementById('debug-toggle');
    this.debugInfoElement = document.getElementById('debug-info');
    this.detectionStatsElement = document.getElementById('detection-stats');
    this.preprocessedCanvas = document.getElementById('preprocessed-canvas');
    this.preprocessedCtx = this.preprocessedCanvas.getContext('2d');
    
    // クエリパラメータでデバッグモードをチェック
    const urlParams = new URLSearchParams(window.location.search);
    this.debugMode = urlParams.get('debug') === 'true';
    
    // デバッグボタンの表示/非表示を設定
    if (this.debugToggleButton) {
      this.debugToggleButton.style.display = this.debugMode ? 'inline-block' : 'none';
    }
    
    // OCRデバッグ情報
    this.ocrResults = [];
    this.currentOcrResult = null;
    this.currentScanRegion = null;
    
    // デバッグモードが有効な場合、初期状態でデバッグ情報を表示
    if (this.debugMode) {
      this.debugInfoElement.style.display = 'block';
      this.debugCanvas.style.display = 'block';
      this.video.style.display = 'none';
      this.debugToggleButton.textContent = 'デバッグ非表示';
      this.debugToggleButton.style.background = '#FF5722';
    }
    
    // カメラ切り替えボタンは初期状態で非表示
    if (this.cameraSwitchButton) {
      this.cameraSwitchButton.style.display = 'none';
    }
    
    this.initializeEventListeners();
    this.initializeResizeHandler();
    this.waitForOpenCV();
  }
  
  waitForOpenCV() {
    this.updateStatus('ライブラリを読み込み中...');
    
    const checkLibraries = () => {
      const opencvReady = typeof window.cv !== 'undefined';
      const tesseractReady = typeof window.Tesseract !== 'undefined';
      
      if (opencvReady && tesseractReady) {
        this.onLibrariesReady();
      } else {
        setTimeout(checkLibraries, 100);
      }
    };
    
    checkLibraries();
  }
  
  async onLibrariesReady() {
    this.opencvReady = true;
    
    try {
      // Tesseractワーカーを初期化
      this.updateStatus('OCRエンジンを初期化中...');
      this.tesseractWorker = await window.Tesseract.createWorker();
      
      await this.tesseractWorker.loadLanguage('eng');
      await this.tesseractWorker.initialize('eng');
      
      // 文字認識のパラメータを設定
      await this.tesseractWorker.setParameters({
        tessedit_char_whitelist: 'ACEFGHJKLMNPRTWXY0123456789',
        tessedit_pageseg_mode: window.Tesseract.PSM.AUTO, // Uniform block of text
        tessedit_ocr_engine_mode: '1', // Neural nets LSTM engine only
      });
      
      this.updateStatus('準備完了: スキャンを開始してください');
      console.log('ライブラリが正常に読み込まれました');
      
    } catch (error) {
      console.error('OCRエンジンの初期化エラー:', error);
      this.updateStatus('OCRエンジンの初期化に失敗しました');
    }
  }
  
  async enumerateCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      console.log(devices);
      this.availableCameras = devices.filter(device => device.kind === 'videoinput');
      
      // カメラ一覧を取得（ボタン表示はカメラ開始時に行う）
      console.log(`${this.availableCameras.length}個のカメラを検出しました`);
      
    } catch (error) {
      console.error('カメラ列挙エラー:', error);
    }
  }
  
  initializeEventListeners() {
    this.startScanButton.addEventListener('click', () => this.startScanning());
    this.rescanButton.addEventListener('click', () => this.startScanning());
    this.copyButton.addEventListener('click', () => this.copyToClipboard());
    this.debugToggleButton.addEventListener('click', () => this.toggleDebugMode());
    
    // カメラ切り替えボタン
    if (this.cameraSwitchButton) {
      this.cameraSwitchButton.addEventListener('click', async () => await this.showCameraModal());
    }
    
    // モーダル関連
    if (this.closeModalButton) {
      this.closeModalButton.addEventListener('click', () => this.hideCameraModal());
    }
    if (this.cameraModal) {
      this.cameraModal.addEventListener('click', (e) => {
        if (e.target === this.cameraModal) {
          this.hideCameraModal();
        }
      });
    }
  }
  
  async showCameraModal() {
    if (this.cameraModal && this.cameraList) {
      // モーダルを開く前に最新のカメラ一覧を取得
      await this.enumerateCameras();
      this.populateCameraList();
      this.cameraModal.style.display = 'block';
    }
  }

  hideCameraModal() {
    if (this.cameraModal) {
      this.cameraModal.style.display = 'none';
    }
  }

  populateCameraList() {
    if (!this.cameraList) return;
    
    this.cameraList.innerHTML = '';
    
    this.availableCameras.forEach((camera, index) => {
      const cameraOption = document.createElement('div');
      cameraOption.className = 'camera-option';
      if (camera.deviceId === this.currentDeviceId) {
        cameraOption.classList.add('selected');
      }
      
      const cameraName = this.getCameraDisplayName(camera);
      
      // 安全にテキストを設定
      const h4 = document.createElement('h4');
      h4.textContent = cameraName;
      
      cameraOption.appendChild(h4);
      
      cameraOption.addEventListener('click', () => {
        this.selectCamera(camera);
        this.hideCameraModal();
      });
      
      this.cameraList.appendChild(cameraOption);
    });
  }

  async selectCamera(camera) {
    try {
      // 現在のストリームを停止
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }
      
      this.currentDeviceId = camera.deviceId;
      
      // 新しいカメラでストリームを開始
      const constraints = this.getCameraConstraints();
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      
      this.video.onloadedmetadata = () => {
        this.setupVideoDisplay();
        
        // カメラが開始されたら、複数のカメラがある場合は切り替えボタンを表示
        if (this.availableCameras.length > 1 && this.cameraSwitchButton) {
          this.cameraSwitchButton.style.display = 'flex';
        }
        
        if (this.state === 'scanning') {
          this.beginContinuousScanning();
        }
      };
      
    } catch (error) {
      console.error('カメラ選択エラー:', error);
      this.updateStatus('カメラの切り替えに失敗しました');
    }
  }
  
  showCameraInfo(message) {
    if (this.cameraInfoElement) {
      this.cameraInfoElement.textContent = message;
      this.cameraInfoElement.style.display = 'block';
    }
  }
  
  async switchCamera() {
    try {
      // 現在のストリームを停止
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
      }
      
      // 次のカメラを選択
      const currentIndex = this.availableCameras.findIndex(camera => camera.deviceId === this.currentDeviceId);
      const nextIndex = (currentIndex + 1) % this.availableCameras.length;
      const nextCamera = this.availableCameras[nextIndex];
      
      this.currentDeviceId = nextCamera.deviceId;
      
      // 新しいカメラでストリームを開始
      const constraints = this.getCameraConstraints();
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      
      // カメラ情報を表示（一時的に）
      const cameraName = this.getCameraDisplayName(nextCamera);
      this.updateStatus(`カメラ切り替え: ${cameraName}`);
      
      // 3秒後にステータスをクリア
      setTimeout(() => {
        if (this.state === 'scanning') {
          this.updateStatus('スキャン中...');
        }
      }, 3000);
      
      this.video.onloadedmetadata = () => {
        this.setupVideoDisplay();
        
        // カメラが開始されたら、複数のカメラがある場合は切り替えボタンを表示
        if (this.availableCameras.length > 1 && this.cameraSwitchButton) {
          this.cameraSwitchButton.style.display = 'flex';
        }
        
        if (this.state === 'scanning') {
          this.beginContinuousScanning();
        }
      };
      
    } catch (error) {
      console.error('カメラ切り替えエラー:', error);
      this.updateStatus('カメラの切り替えに失敗しました');
    }
  }
  
  getCameraDisplayName(camera) {
    // MediaDeviceInfoのlabelを直接使用
    if (camera.label) {
      return camera.label;
    }
    
    // labelが空の場合（権限がない場合など）のフォールバック
    const index = this.availableCameras.indexOf(camera) + 1;
    return `カメラ ${index}`;
  }
  
  getCameraConstraints() {
    const baseConstraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        focusMode: 'continuous',
        facingMode: 'environment'
      }
    };
    
    // 特定のカメラが選択されている場合
    if (this.currentDeviceId) {
      baseConstraints.video.deviceId = { exact: this.currentDeviceId };
      delete baseConstraints.video.facingMode; // deviceIdを指定する場合はfacingModeを削除
    }
    
    return baseConstraints;
  }
  
  async startScanning() {
    try {
      this.updateStatus('カメラにアクセス中...');
      this.setState('scanning');
      
      // カメラが既に起動している場合は、スキャンのみ再開
      if (this.stream) {
        this.resumeCamera(); // カメラを再開
        this.beginContinuousScanning();
        return;
      }
      
      const constraints = this.getCameraConstraints();
      
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      
      // カメラアクセス成功後に利用可能なカメラを列挙
      await this.enumerateCameras();
      
      // 現在使用中のカメラのデバイスIDを保存
      if (!this.currentDeviceId) {
        const track = this.stream.getVideoTracks()[0];
        const settings = track.getSettings();
        this.currentDeviceId = settings.deviceId;
        
        // カメラ名を表示
        const currentCamera = this.availableCameras.find(camera => camera.deviceId === this.currentDeviceId);
        if (currentCamera) {
          const cameraName = this.getCameraDisplayName(currentCamera);
          this.showCameraInfo(`使用中: ${cameraName}`);
        }
      }
      
      this.video.onloadedmetadata = () => {
        this.setupVideoDisplay();
        
        // カメラが開始されたら、複数のカメラがある場合は切り替えボタンを表示
        if (this.availableCameras.length > 1 && this.cameraSwitchButton) {
          this.cameraSwitchButton.style.display = 'flex';
        }
        
        this.beginContinuousScanning();
      };
      
    } catch (error) {
      console.error('カメラのアクセスエラー:', error);
      this.updateStatus('カメラにアクセスできませんでした。ブラウザでカメラの許可を与えてください。');
      this.setState('waiting');
    }
  }
  
  beginContinuousScanning() {
    this.updateStatus('スキャン中... ガイド枠を検出しています');
    
    // 連続スキャンを開始（100msごと）
    this.scanningInterval = setInterval(() => {
      this.performScan();
    }, 100);
  }
  
  stopScanning() {
    if (this.scanningInterval) {
      clearInterval(this.scanningInterval);
      this.scanningInterval = null;
    }
  }
  
  stopCamera() {
    this.stopScanning();
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    this.video.srcObject = null;
    
    // カメラが停止されたら切り替えボタンを非表示
    if (this.cameraSwitchButton) {
      this.cameraSwitchButton.style.display = 'none';
    }
  }
  
  // リソースクリーンアップ
  async cleanup() {
    this.stopCamera();
    
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate();
      this.tesseractWorker = null;
    }
  }
  
  async performScan() {
    if (!this.opencvReady || !this.tesseractWorker || this.state !== 'scanning') {
      return;
    }
    
    try {
      // キャンバスに現在のビデオフレームを描画（正方形でトリミング）
      this.drawVideoToCanvas();
      
      // OpenCVで画像処理とOCR
      const result = await this.processImageWithOpenCV();
      
      if (result && result.scannedText && result.scannedText.trim()) {
        // マーカーが検出されたら複数回OCRを実行
        this.updateStatus('コードを検出しました。精度向上のため複数回読み取り中...');
        const finalCode = await this.performMultipleOCR();
        
        if (finalCode) {
          this.onScanCompleted(finalCode);
        } else {
          // 複数回の読み取りでも有効なコードが得られなかった場合
          this.updateStatus('スキャン中... ガイド枠を検出しています');
        }
      } else if (result && !result.guideDetected) {
        // ガイドが検出されていない場合のフィードバック
        this.updateStatus('スキャン中... ガイド枠をカメラに映してください');
      } else {
        // ガイドは検出されているがコードが読めない場合
        this.updateStatus('スキャン中... ガイド枠内にコードを合わせてください');
      }
      
    } catch (error) {
      console.error('スキャンエラー:', error);
    }
  }
  
  onScanCompleted(scannedText) {
    this.stopScanning();
    this.pauseCamera(); // カメラを一時停止
    this.setState('completed');
    this.displayScannedCode(scannedText);
    this.updateStatus('スキャン完了!');
  }
  
  pauseCamera() {
    // ビデオストリームを一時停止（ストリーム自体は保持）
    if (this.video && this.video.srcObject) {
      this.video.pause();
    }
  }
  
  resumeCamera() {
    // ビデオストリームを再開
    if (this.video && this.video.srcObject) {
      this.video.play();
    }
  }
  
  setState(newState) {
    this.state = newState;
    this.updateUI();
  }
  
  updateUI() {
    // ボタンの表示/非表示を状態に応じて切り替え
    switch (this.state) {
      case 'waiting':
        this.startScanButton.style.display = 'block';
        this.startScanButton.disabled = false;
        this.rescanButton.style.display = 'none';
        this.scannedCodeElement.style.display = 'none';
        break;
        
      case 'scanning':
        this.startScanButton.style.display = 'none';
        this.rescanButton.style.display = 'none';
        this.scannedCodeElement.style.display = 'none';
        break;
        
      case 'completed':
        this.startScanButton.style.display = 'none';
        this.rescanButton.style.display = 'block';
        this.rescanButton.disabled = false;
        break;
    }
  }
  
  async performMultipleOCR() {
    const targetSuccessCount = 5;
    const scanResults = [];
    let attempts = 0;
    const maxAttempts = 50; // 無限ループを防ぐための上限
    
    // デバッグ用: 複数回スキャンの結果を追跡
    if (this.debugMode) {
      console.log(`=== 複数回OCR開始: ${targetSuccessCount}回成功を目標 ===`);
    }
    
    try {
      // 5回成功するまで繰り返し
      while (scanResults.length < targetSuccessCount && attempts < maxAttempts) {
        attempts++;
        
        // 少し待機してフレームを変える
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 最新フレームを取得
        this.drawVideoToCanvas();
        
        const result = await this.processImageWithOpenCV();
        
        // デバッグモードでは試行回数も記録
        if (this.debugMode && this.currentOcrResult) {
          this.currentOcrResult.attemptNumber = attempts;
          this.currentOcrResult.totalAttempts = `${attempts}/${maxAttempts}`;
          this.currentOcrResult.successCount = `${scanResults.length}/${targetSuccessCount}`;
        }
        
        // 有効な16文字のコードの場合のみ成功カウントに追加
        if (result && result.guideDetected && result.scannedText && this.isValidCode(result.scannedText)) {
          scanResults.push(result.scannedText);
          console.log(`有効スキャン ${scanResults.length}/${targetSuccessCount}: ${result.scannedText}`);
        }
      }
      
      if (scanResults.length < targetSuccessCount) {
        console.log(`最大試行回数に到達。成功回数: ${scanResults.length}/${targetSuccessCount}`);
        return null;
      }
      
      console.log(`${targetSuccessCount}回の有効スキャンが完了。結果を統合中...`);
      
      // 成功した11回の結果から最も信頼性の高いコードを決定
      const finalCode = this.determineMostLikelyCode(scanResults);
      return finalCode;
      
    } catch (error) {
      console.error('複数回OCRエラー:', error);
      return null;
    }
  }

  determineMostLikelyCode(scanResults) {
    if (!scanResults || scanResults.length === 0) {
      return null;
    }
    
    console.log(`${scanResults.length}個の有効な結果から最適なコードを算出中...`);
    
    // 16文字の位置ごとに文字の出現回数をカウント
    const characterCounts = Array(16).fill(null).map(() => ({}));
    
    for (const code of scanResults) {
      // ここに来る時点で既にisValidCodeでチェック済み
      for (let i = 0; i < 16; i++) {
        const char = code[i];
        characterCounts[i][char] = (characterCounts[i][char] || 0) + 1;
      }
    }
    
    // 各位置で最も多く出現した文字を選択し、統計情報も出力
    let finalCode = '';
    for (let i = 0; i < 16; i++) {
      const counts = characterCounts[i];
      
      if (Object.keys(counts).length === 0) {
        console.error(`位置 ${i} に有効な文字がありません`);
        return null;
      }
      
      // 最も多く出現した文字を取得
      const mostFrequentChar = Object.keys(counts).reduce((a, b) => 
        counts[a] > counts[b] ? a : b
      );
      
      const maxCount = counts[mostFrequentChar];
      const confidence = (maxCount / scanResults.length * 100).toFixed(1);
      
      console.log(`位置 ${i}: '${mostFrequentChar}' (${maxCount}/${scanResults.length}回, ${confidence}%)`);
      
      finalCode += mostFrequentChar;
    }
    
    console.log(`最終統合結果: ${finalCode}`);
    
    // 最終的なコードの検証（念のため）
    if (this.isValidCode(finalCode)) {
      return finalCode;
    }
    
    console.error('統合結果が無効なコードです');
    return null;
  }

  isValidCode(code) {
    if (!code || code.length !== 16) {
      return false;
    }
    
    // 禁止文字（B、D、I、O、Q、S、U、V、Z）が含まれていないかチェック
    const forbiddenChars = /[BDIOQSUVZ]/;
    if (forbiddenChars.test(code)) {
      return false;
    }
    
    // 許可された文字のみで構成されているかチェック
    const allowedChars = /^[ACEFGHJKLMNPRTWXY0123456789]+$/;
    return allowedChars.test(code);
  }

  async processImageWithOpenCV() {
    try {
      // キャンバスからOpenCV Matオブジェクトを作成
      const src = window.cv.imread(this.canvas);
      
      // ガイド検出を先に実行
      const guideDetection = this.detectGuideMarkers(src);
      
      if (!guideDetection.found) {
        // ガイドが検出できない場合
        src.delete();
        return { 
          guideDetected: false, 
          scannedText: null 
        };
      }
      
      // スキャナーのフレーム領域を抽出（角度補正付き）
      const scanRegion = this.extractScanRegion(src, guideDetection);
      
      // 画像前処理でOCR精度を向上
      const preprocessed = this.preprocessForOCR(scanRegion);
      
      // OCR処理
      const scannedText = await this.performOCR(preprocessed);
      
      // メモリクリーンアップ
      src.delete();
      scanRegion.delete();
      preprocessed.delete();
      
      return {
        guideDetected: true,
        scannedText: scannedText
      };
      
    } catch (error) {
      console.error('OpenCV処理エラー:', error);
      return { 
        guideDetected: false, 
        scannedText: null 
      };
    }
  }
  
  extractScanRegion(src, guideDetection = null) {
    // ガイド検出結果が渡されていない場合は検出を実行
    if (!guideDetection) {
      guideDetection = this.detectGuideMarkers(src);
    }
    
    if (!guideDetection.found) {
      // ガイドが検出できない場合は従来の固定位置を使用
      console.log('ガイドマーカーが検出できません。固定位置を使用します。');
      const fixedRegion = this.extractFixedRegion(src);
      
      // デバッグ用に固定領域を保存
      if (this.debugMode) {
        this.currentScanRegion = {
          x: Math.floor(src.cols / 2) - 66,
          y: Math.floor(src.rows / 2) - 54,
          width: 132,
          height: 108,
          image: fixedRegion.clone(),
          type: 'fixed'
        };
        this.updateScanRegionDebugView();
      }
      
      return fixedRegion;
    }
    
    console.log('ガイドマーカーを検出しました。角度補正を実行します。');
    
    // 角度補正を実行
    const correctedImage = this.correctAngle(src, guideDetection);
    
    // 補正後の画像からコード領域を抽出
    const codeRegion = this.extractCodeRegionFromCorrected(correctedImage);
    
    // デバッグ用に補正後の領域を保存
    if (this.debugMode) {
      this.currentScanRegion = {
        x: 0, // 補正後の画像内での座標
        y: 0,
        width: codeRegion.cols,
        height: codeRegion.rows,
        image: codeRegion.clone(),
        type: 'corrected',
        guideDetection: guideDetection
      };
      this.updateScanRegionDebugView();
    }
    
    // 補正画像のメモリを解放
    correctedImage.delete();
    
    return codeRegion;
  }
  
  extractFixedRegion(src) {
    // 従来の固定位置抽出（フォールバック用）
    const centerX = Math.floor(src.cols / 2);
    const centerY = Math.floor(src.rows / 2);
    const width = 132;  // 11mm相当
    const height = 108; // 9mm相当
    
    const rect = new window.cv.Rect(
      centerX - width / 2,
      centerY - height / 2,
      width,
      height
    );
    
    return src.roi(rect);
  }
  
    detectGuideMarkers(src) {
    const startTime = performance.now();
    const gray = new window.cv.Mat();
    const edges = new window.cv.Mat();
    const lines = new window.cv.Mat();
    
    // デバッグ用統計情報
    const stats = {
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
      scanRegion: null,
      error: null
    };
    
    try {
      // スキャンガイド範囲を定義（画面中央の限定領域）
      const centerX = src.cols / 2;
      const centerY = src.rows / 2;
      const scanWidth = 240;  // スキャンエリアの幅（300→240に調整）
      const scanHeight = 200; // スキャンエリアの高さ（120→200に拡大）
      
      const scanRegion = {
        x: centerX - scanWidth / 2,
        y: centerY - scanHeight / 2,
        width: scanWidth,
        height: scanHeight
      };
      
      stats.scanRegion = scanRegion;
      
      // スキャン領域のみを抽出
      const scanRect = new window.cv.Rect(scanRegion.x, scanRegion.y, scanRegion.width, scanRegion.height);
      const regionOfInterest = src.roi(scanRect);
      
      // グレースケール変換
      const roiGray = new window.cv.Mat();
      window.cv.cvtColor(regionOfInterest, roiGray, window.cv.COLOR_RGBA2GRAY);
      
      // エッジ検出（パラメータを調整してより精密に）
      window.cv.Canny(roiGray, edges, 80, 200);
      
      // ハフ線変換で直線を検出（非常に長い線のみを検出）
      window.cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 10, 150, 30);
      
      // メモリクリーンアップ
      regionOfInterest.delete();
      roiGray.delete();
      
      stats.linesFound = lines.rows;
      
      const verticalLines = [];
      
      // 垂直線を抽出（スキャン領域座標で）
      for (let i = 0; i < lines.rows; i++) {
        const line = lines.data32S.slice(i * 4, i * 4 + 4);
        const [x1, y1, x2, y2] = line;
        
        // 線の角度を計算
        const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        const normalizedAngle = Math.abs(angle);
        
        // 垂直線の判定（±20度の範囲に拡大）
        if (normalizedAngle > 70 && normalizedAngle < 110) {
          const lineLength = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
          
          // 150px以上の線分のみを対象
          if (lineLength >= 150) {
            const centerX = (x1 + x2) / 2;
            const centerY = (y1 + y2) / 2;
            
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
            });
            
            console.log(`垂直線 ${verticalLines.length}: 長さ=${lineLength.toFixed(1)}, 角度=${normalizedAngle.toFixed(1)}°, ローカル中心=(${centerX.toFixed(1)}, ${centerY.toFixed(1)})`);
          }
        }
      }
      
      stats.verticalLines = verticalLines.length;
      stats.detectedLines = verticalLines;
      
      // 近い線分をマージ
      const mergedLines = this.mergeCloseLines(verticalLines);
      stats.mergedLines = mergedLines.length;
      stats.mergedDetectedLines = mergedLines;
      
      console.log(`${verticalLines.length}本の垂直線を${mergedLines.length}本にマージしました`);
      
      stats.verticalLines = verticalLines.length;
      stats.detectedLines = verticalLines;
      
      // 括弧ペアを検出（マージされた線を使用）
      const bracketPairs = [];
      
      console.log(`=== 括弧ペア検出開始: ${mergedLines.length}本のマージ済み線を処理 ===`);
      
      for (let i = 0; i < mergedLines.length - 1; i++) {
        for (let j = i + 1; j < mergedLines.length; j++) {
          const line1 = mergedLines[i];
          const line2 = mergedLines[j];
          
          console.log(`線ペア ${i}-${j}: 線1(${line1.centerX.toFixed(1)}, ${line1.centerY.toFixed(1)}, 長さ${line1.length.toFixed(1)}) vs 線2(${line2.centerX.toFixed(1)}, ${line2.centerY.toFixed(1)}, 長さ${line2.length.toFixed(1)})`);
          
          // 水平距離を計算
          const horizontalDistance = Math.abs(line2.centerX - line1.centerX);
          
          // 垂直位置の重複をチェック
          const minY1 = Math.min(line1.y1, line1.y2);
          const maxY1 = Math.max(line1.y1, line1.y2);
          const minY2 = Math.min(line2.y1, line2.y2);
          const maxY2 = Math.max(line2.y1, line2.y2);
          
          const verticalOverlap = Math.min(maxY1, maxY2) - Math.max(minY1, minY2);
          const overlapRatio = verticalOverlap / Math.min(line1.length, line2.length);
          
          console.log(`  水平距離: ${horizontalDistance.toFixed(1)}px, 垂直重複: ${verticalOverlap.toFixed(1)}px (重複率: ${(overlapRatio*100).toFixed(1)}%)`);
          
          // 括弧ペアの条件（横線がない前提で調整）
          // 1. 適切な水平距離（50-220px：OCR可能な距離から検出範囲いっぱいまで）
          // 2. 垂直位置が重複している（30%以上：緩和）
          // 3. 両方とも十分な長さ（20px以上：緩和）
          const distanceOK = horizontalDistance > 50 && horizontalDistance < 220;
          const overlapOK = overlapRatio > 0.3;
          const lengthOK = line1.length > 20 && line2.length > 20;
          
          console.log(`  条件チェック: 距離=${distanceOK ? 'OK' : 'NG'}(${horizontalDistance.toFixed(1)}/50-220), 重複=${overlapOK ? 'OK' : 'NG'}(${(overlapRatio*100).toFixed(1)}%/30%), 長さ=${lengthOK ? 'OK' : 'NG'}(${line1.length.toFixed(1)},${line2.length.toFixed(1)}/20)`);
          
          if (distanceOK && overlapOK && lengthOK) {
            
            const leftLine = line1.centerX < line2.centerX ? line1 : line2;
            const rightLine = line1.centerX < line2.centerX ? line2 : line1;
            
            const bracketCenter = {
              x: (leftLine.globalCenterX + rightLine.globalCenterX) / 2,
              y: (leftLine.globalCenterY + rightLine.globalCenterY) / 2
            };
            
            bracketPairs.push({
              leftLine,
              rightLine,
              center: bracketCenter,
              width: horizontalDistance,
              height: Math.min(line1.length, line2.length),
              overlapRatio
            });
            
            console.log(`    ✓ 括弧ペア候補に追加: ${bracketPairs.length}番目 - 幅=${horizontalDistance.toFixed(1)}, 重複率=${(overlapRatio*100).toFixed(1)}%`);
          } else {
            console.log(`    ✗ 括弧ペア条件を満たさず`);
          }
        }
      }
      
      console.log(`=== 括弧ペア検出結果: ${bracketPairs.length}個の候補が見つかりました ===`);
      
      stats.bracketPairs = bracketPairs.length;
      stats.bracketCandidates = bracketPairs;
      
      // 最適な括弧ペアを選択
      if (bracketPairs.length > 0) {
        const centerX = src.cols / 2;
        const centerY = src.rows / 2;
        
        let bestBracket = bracketPairs[0];
        let minDistance = Number.MAX_VALUE;
        let bestIndex = 0;
        
        for (let i = 0; i < bracketPairs.length; i++) {
          const bracket = bracketPairs[i];
          const distance = Math.sqrt(
            Math.pow(bracket.center.x - centerX, 2) + Math.pow(bracket.center.y - centerY, 2)
          );
          
          console.log(`  括弧ペア ${i}: 中央からの距離=${distance.toFixed(1)}`);
          
          if (distance < minDistance) {
            minDistance = distance;
            bestBracket = bracket;
            bestIndex = i;
          }
        }
        
        stats.selectedIndex = bestIndex;
        stats.selectedBracket = true;
        stats.guideDetected = true;
        
        console.log(`最適な括弧ペアを選択: インデックス ${bestIndex}, 距離=${minDistance.toFixed(1)}`);
        
        // 括弧ペアから仮想的な矩形を構築（グローバル座標で）
        const virtualRect = {
          x: bestBracket.leftLine.globalCenterX - 10,
          y: Math.min(
            Math.min(bestBracket.leftLine.globalY1, bestBracket.leftLine.globalY2),
            Math.min(bestBracket.rightLine.globalY1, bestBracket.rightLine.globalY2)
          ),
          width: bestBracket.width + 20,
          height: bestBracket.height
        };
        
        // 仮想的な角点を生成（グローバル座標で）
        const virtualCorners = [
          { x: virtualRect.x, y: virtualRect.y }, // 左上
          { x: virtualRect.x + virtualRect.width, y: virtualRect.y }, // 右上
          { x: virtualRect.x + virtualRect.width, y: virtualRect.y + virtualRect.height }, // 右下
          { x: virtualRect.x, y: virtualRect.y + virtualRect.height } // 左下
        ];
        
        const result = {
          found: true,
          rect: virtualRect,
          corners: virtualCorners,
          bracket: bestBracket,
          contour: null // 括弧検出では輪郭は不要
        };
        
        stats.processingTime = performance.now() - startTime;
        
        // デバッグ可視化
        this.drawDebugVisualization(src, result, stats);
        this.updateDetectionStats(stats);
        
        return result;
      }
      
      console.log('適切な括弧ペアが見つかりませんでした');
      
      const result = { found: false };
      stats.processingTime = performance.now() - startTime;
      
      // デバッグ可視化
      this.drawDebugVisualization(src, result, stats);
      this.updateDetectionStats(stats);
      
      return result;
      
    } catch (error) {
      console.error('ガイド検出エラー:', error);
      stats.error = error.message;
      stats.processingTime = performance.now() - startTime;
      
      this.updateDetectionStats(stats);
      
      return { found: false };
    } finally {
      gray.delete();
      edges.delete();
      lines.delete();
    }
  }
  
  getCornerPoints(approx) {
    // 4点の角を取得して適切に並び替え
    const points = [];
    const data = approx.data32S;
    
    for (let i = 0; i < 4; i++) {
      points.push({
        x: data[i * 2],
        y: data[i * 2 + 1]
      });
    }
    
    // 重心を計算
    const centerX = points.reduce((sum, p) => sum + p.x, 0) / 4;
    const centerY = points.reduce((sum, p) => sum + p.y, 0) / 4;
    
    // 重心からの角度でソート
    points.forEach(point => {
      point.angle = Math.atan2(point.y - centerY, point.x - centerX);
    });
    
    // 角度でソート（-π から π の範囲）
    points.sort((a, b) => a.angle - b.angle);
    
    // 左上から時計回りに並べ替え
    // atan2の結果に基づいて適切な順序に配置
    const topLeft = points.find(p => p.angle >= -Math.PI && p.angle < -Math.PI/2) || points[0];
    const topRight = points.find(p => p.angle >= -Math.PI/2 && p.angle < 0) || points[1];
    const bottomRight = points.find(p => p.angle >= 0 && p.angle < Math.PI/2) || points[2];
    const bottomLeft = points.find(p => p.angle >= Math.PI/2 && p.angle <= Math.PI) || points[3];
    
    return [topLeft, topRight, bottomRight, bottomLeft];
  }
  
  correctAngle(src, guideDetection) {
    const { corners } = guideDetection;
    
    // 透視変換用の座標を設定
    const srcPoints = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, [
      corners[0].x, corners[0].y,  // 左上
      corners[1].x, corners[1].y,  // 右上
      corners[2].x, corners[2].y,  // 右下
      corners[3].x, corners[3].y   // 左下
    ]);
    
    // 補正後の矩形サイズを計算
    const width = Math.max(
      Math.sqrt(Math.pow(corners[1].x - corners[0].x, 2) + Math.pow(corners[1].y - corners[0].y, 2)),
      Math.sqrt(Math.pow(corners[2].x - corners[3].x, 2) + Math.pow(corners[2].y - corners[3].y, 2))
    );
    
    const height = Math.max(
      Math.sqrt(Math.pow(corners[3].x - corners[0].x, 2) + Math.pow(corners[3].y - corners[0].y, 2)),
      Math.sqrt(Math.pow(corners[2].x - corners[1].x, 2) + Math.pow(corners[2].y - corners[1].y, 2))
    );
    
    // 目標座標（正方形に補正）
    const dstPoints = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, [
      0, 0,
      width, 0,
      width, height,
      0, height
    ]);
    
    // 透視変換行列を計算
    const transform = window.cv.getPerspectiveTransform(srcPoints, dstPoints);
    
    // 変換を適用
    const corrected = new window.cv.Mat();
    const dsize = new window.cv.Size(width, height);
    window.cv.warpPerspective(src, corrected, transform, dsize);
    
    // メモリクリーンアップ
    srcPoints.delete();
    dstPoints.delete();
    transform.delete();
    
    // contourがnullでない場合のみdelete
    if (guideDetection.contour) {
      guideDetection.contour.delete();
    }
    
    return corrected;
  }
  
  extractCodeRegionFromCorrected(correctedImage) {
    // 補正済み画像からコード領域を抽出
    // 固定領域と同じサイズ（132x108px）を使用
    const totalWidth = correctedImage.cols;
    const totalHeight = correctedImage.rows;
    
    // 固定領域より少し大きめのサイズ
    const codeWidth = 180;
    const codeHeight = 128;
    
    // 中央に配置
    const startX = Math.floor((totalWidth - codeWidth) / 2);
    const startY = Math.floor((totalHeight - codeHeight) / 2);
    
    console.log(`コード領域抽出: 画像サイズ=${totalWidth}x${totalHeight}, 抽出領域=${codeWidth}x${codeHeight}, 開始位置=(${startX}, ${startY})`);
    
    const rect = new window.cv.Rect(startX, startY, codeWidth, codeHeight);
    
    return correctedImage.roi(rect);
  }
  
  preprocessForOCR(src) {
    const gray = new window.cv.Mat();
    const binary = new window.cv.Mat();
    const processed = new window.cv.Mat();
    
    // グレースケールに変換
    window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);
    
    // ガウシアンブラーでノイズ除去
    const kernelSize = new window.cv.Size(3, 3);
    window.cv.GaussianBlur(gray, gray, kernelSize, 0);
    
    // 適応的二値化でコントラストを強調
    window.cv.adaptiveThreshold(
      gray, 
      binary, 
      255, 
      window.cv.ADAPTIVE_THRESH_GAUSSIAN_C, 
      window.cv.THRESH_BINARY, 
      11, 
      2
    );
    
    // モルフォロジー処理で文字を鮮明化
    const kernel = window.cv.getStructuringElement(
      window.cv.MORPH_RECT, 
      new window.cv.Size(2, 2)
    );
    window.cv.morphologyEx(binary, processed, window.cv.MORPH_CLOSE, kernel);
    

    
    // メモリクリーンアップ
    gray.delete();
    binary.delete();
    kernel.delete();
    
    return processed;
  }
  
  async performOCR(processedImage) {
    try {
      console.log('OCR処理開始: 単一画像OCR');
      
      // 単一画像でOCR実行
      const result = await this.performSingleOCR(processedImage, 'full');
      
      console.log('OCR完了:', result);
      
      return result;
      
    } catch (error) {
      console.error('OCR実行エラー:', error);
      
      // エラーもデバッグ情報として保存
      this.currentOcrResult = {
        timestamp: Date.now(),
        rawText: `エラー: ${error.message}`,
        cleanText: '',
        formattedCode: null,
        valid: false,
        text: `エラー: ${error.message}`
      };
      
      return null;
    }
  }
  

  
  async performSingleOCR(image, label) {
    try {
      // OpenCV MatをCanvasに描画
      const tempCanvas = document.createElement('canvas');
      window.cv.imshow(tempCanvas, image);
      
      // Tesseract.jsでOCR実行
      const { data: { text } } = await this.tesseractWorker.recognize(tempCanvas);
      console.log(`OCR結果(${label}):`, text);
      
      // 結果をクリーニング
      const cleanText = text.replace(/[\s\n\r]/g, '');
      
      // 結果を検証・整形
      const formattedCode = this.validateAndFormatCode(cleanText);
      
      // デバッグ用にOCR結果を保存
      const ocrResult = {
        timestamp: Date.now(),
        label: label,
        rawText: text,
        cleanText: cleanText,
        formattedCode: formattedCode,
        valid: formattedCode !== null,
        text: formattedCode || cleanText || '(空)'
      };
      
      this.currentOcrResult = ocrResult;
      this.ocrResults.push(ocrResult);
      
      // 履歴は最大20件まで保持
      if (this.ocrResults.length > 20) {
        this.ocrResults.shift();
      }
      
      return formattedCode || cleanText;
      
    } catch (error) {
      console.error(`OCR実行エラー(${label}):`, error);
      return '';
    }
  }
  

  
  validateAndFormatCode(rawText) {
    if (!rawText) return null;
    
    // 改行、スペース、特殊文字を除去
    const cleanText = rawText.replace(/[\s\n\r]/g, '');
    
    // 括弧で囲まれた16文字のパターンを検索
    const bracketPattern = /\[([ACEFGHJKLMNPRTWXY0123456789]{16})\]/;
    const match = cleanText.match(bracketPattern);
    
    if (match) {
      const code = match[1];
      if (this.isValidCode(code)) {
        return code;
      }
    }
    
    // より柔軟なパターンマッチング（括弧が認識されない場合）
    const flexiblePattern = /([ACEFGHJKLMNPRTWXY0123456789]{16})/;
    const flexibleMatch = cleanText.match(flexiblePattern);
    
    if (flexibleMatch) {
      const code = flexibleMatch[1];
      if (this.isValidCode(code)) {
        return code;
      }
    }
    
    return null;
  }
  

  
  displayScannedCode(code) {
    // 元のコードを保存
    this.lastScannedCode = code;
    
    // 8文字で改行を入れて表示
    const formattedCode = code.substring(0, 8) + '\n' + code.substring(8);
    this.codeTextElement.textContent = formattedCode;
    this.scannedCodeElement.style.display = 'block';
  }
  
  async copyToClipboard() {
    // 保存された元のコードを使用（改行なし）
    const code = this.lastScannedCode || this.codeTextElement.textContent.replace(/\n/g, '');
    
    try {
      await navigator.clipboard.writeText(code);
      this.updateStatus('クリップボードにコピーしました!');
      
      // 成功フィードバック
      const originalText = this.copyButton.textContent;
      this.copyButton.textContent = 'コピー完了!';
      this.copyButton.style.background = '#4CAF50';
      
      setTimeout(() => {
        this.copyButton.textContent = originalText;
        this.copyButton.style.background = '#FF9800';
      }, 2000);
      
    } catch (error) {
      console.error('クリップボードへのコピーエラー:', error);
      this.updateStatus('クリップボードへのコピーに失敗しました');
    }
  }
  
  updateStatus(message) {
    this.statusElement.textContent = message;
    console.log('ステータス:', message);
  }

  setupVideoDisplay() {
    const videoWidth = this.video.videoWidth;
    const videoHeight = this.video.videoHeight;
    
    // 正方形のサイズを決定（短い方の辺に合わせる）
    const squareSize = Math.min(videoWidth, videoHeight);
    
    // コンテナのサイズを取得
    const container = document.getElementById('camera-section');
    const containerWidth = container.clientWidth;
    const containerPadding = 48; // scanner-containerのpadding(24px * 2)
    const availableWidth = Math.min(containerWidth, window.innerWidth - containerPadding);
    
    // 表示サイズを決定（コンテナに収まるように）
    const maxDisplaySize = Math.min(
      availableWidth * 0.95,  // コンテナ幅の95%
      window.innerHeight * 0.5, // 画面高さの50%
      400 // 最大400px
    );
    const displaySize = Math.min(squareSize, maxDisplaySize);
    
    // キャンバスの実際のサイズ（処理用）
    this.canvas.width = squareSize;
    this.canvas.height = squareSize;
    
    // ビデオとキャンバスの表示サイズを正方形に設定
    const sizeStr = displaySize + 'px';
    
    this.video.style.width = sizeStr;
    this.video.style.height = sizeStr;
    this.video.style.objectFit = 'cover';
    this.video.style.borderRadius = '12px';
    this.video.style.display = 'block';
    this.video.style.margin = '0 auto';
    
    this.canvas.style.width = sizeStr;
    this.canvas.style.height = sizeStr;
    this.canvas.style.display = 'none'; // キャンバスは非表示のまま
    
    // デバッグキャンバスも同じサイズに設定
    this.debugCanvas.style.width = sizeStr;
    this.debugCanvas.style.height = sizeStr;
    this.debugCanvas.style.borderRadius = '12px';
    this.debugCanvas.style.margin = '0 auto';
    this.debugCanvas.style.position = 'relative';
    this.debugCanvas.style.display = this.debugMode ? 'block' : 'none';
    
    // トリミング用の座標を計算
    this.cropOffsetX = (videoWidth - squareSize) / 2;
    this.cropOffsetY = (videoHeight - squareSize) / 2;
    
    console.log(`ビデオサイズ: ${videoWidth}x${videoHeight}`);
    console.log(`正方形サイズ: ${squareSize}x${squareSize}`);
    console.log(`表示サイズ: ${displaySize}x${displaySize}`);
    console.log(`コンテナ幅: ${containerWidth}px`);
    console.log(`トリミングオフセット: (${this.cropOffsetX}, ${this.cropOffsetY})`);
  }
  
  drawVideoToCanvas() {
    // ビデオの中央部分を正方形でトリミングしてキャンバスに描画
    this.ctx.drawImage(
      this.video,
      this.cropOffsetX, this.cropOffsetY,          // ソースの開始位置
      this.canvas.width, this.canvas.height,       // ソースのサイズ
      0, 0,                                        // 描画先の開始位置
      this.canvas.width, this.canvas.height        // 描画先のサイズ
    );
  }

  initializeResizeHandler() {
    // 画面サイズ変更やデバイス回転に対応
    let resizeTimeout;
    const handleResize = () => {
      if (resizeTimeout) {
        window.clearTimeout(resizeTimeout);
      }
      resizeTimeout = window.setTimeout(() => {
        if (this.video && this.video.videoWidth > 0) {
          console.log('画面サイズが変更されました。ビデオ表示を再調整します。');
          this.setupVideoDisplay();
        }
      }, 250);
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
  }

  toggleDebugMode() {
    this.debugMode = !this.debugMode;
    
    if (this.debugMode) {
      this.debugToggleButton.textContent = 'デバッグ非表示';
      this.debugToggleButton.style.background = '#FF5722';
      this.debugCanvas.style.display = 'block';
      this.debugCanvas.style.margin = '0 auto';
      this.debugCanvas.style.borderRadius = '12px';
      this.debugCanvas.style.position = 'relative';
      this.debugInfoElement.style.display = 'block';
      this.video.style.display = 'none';
      console.log('デバッグモードが有効になりました');
    } else {
      this.debugToggleButton.textContent = 'デバッグ表示';
      this.debugToggleButton.style.background = '#607D8B';
      this.debugCanvas.style.display = 'none';
      this.debugInfoElement.style.display = 'none';
      this.video.style.display = 'block';
      console.log('デバッグモードが無効になりました');
    }
  }
  
  updateScanRegionDebugView() {
    if (!this.debugMode || !this.currentScanRegion) return;
    
    try {
      const scanRegion = this.currentScanRegion;
      
      // キャンバスサイズを検出した領域の実際のサイズに設定
      const actualWidth = scanRegion.width;
      const actualHeight = scanRegion.height;
      
      this.preprocessedCanvas.width = actualWidth;
      this.preprocessedCanvas.height = actualHeight;
      this.preprocessedCanvas.style.width = actualWidth + 'px';
      this.preprocessedCanvas.style.height = actualHeight + 'px';
      
      // 検出されたスキャン領域を表示
      if (scanRegion.image) {
        if (scanRegion.image.channels() === 1) {
          // グレースケール画像の場合はRGBに変換
          const rgbMat = new window.cv.Mat();
          window.cv.cvtColor(scanRegion.image, rgbMat, window.cv.COLOR_GRAY2RGB);
          window.cv.imshow(this.preprocessedCanvas, rgbMat);
          rgbMat.delete();
        } else {
          window.cv.imshow(this.preprocessedCanvas, scanRegion.image);
        }
      }
      
      console.log(`スキャン領域デバッグビュー更新: ${actualWidth}x${actualHeight}px, 座標:(${scanRegion.x}, ${scanRegion.y})`);
      
    } catch (error) {
      console.error('スキャン領域デバッグビューの更新エラー:', error);
    }
  }

  updateDetectionStats(stats) {
    if (!this.debugMode) return;
    
    // OCR結果の履歴表示
    const recentOcrResults = this.ocrResults.slice(-5).map((result, index) => {
      const timeago = ((Date.now() - result.timestamp) / 1000).toFixed(1);
      return `  ${index + 1}. "${result.text}" (${timeago}秒前, 有効:${result.valid ? 'はい' : 'いいえ'})`;
    }).join('\n');
    
    const currentOcrText = this.currentOcrResult ? 
      `現在のOCR: "${this.currentOcrResult.rawText}" → "${this.currentOcrResult.cleanText}" (有効:${this.currentOcrResult.valid ? 'はい' : 'いいえ'})
${this.currentOcrResult.attemptNumber ? `試行: ${this.currentOcrResult.totalAttempts}, 成功: ${this.currentOcrResult.successCount}` : ''}` : 
      '現在のOCR: なし';
    
    const statsText = `
検出統計情報:
- フレームサイズ: ${stats.frameSize}
- スキャン領域: ${stats.scanRegion ? `${stats.scanRegion.width}x${stats.scanRegion.height}` : 'なし'}
- 検出された線分数: ${stats.linesFound}
- 垂直線数: ${stats.verticalLines}
- マージ後線数: ${stats.mergedLines}
- 括弧ペア候補数: ${stats.bracketPairs}
- 選択された括弧: ${stats.selectedBracket ? 'あり' : 'なし'}
- ガイド検出成功: ${stats.guideDetected ? 'はい' : 'いいえ'}
- 検出エラー: ${stats.error || 'なし'}
- 処理時間: ${stats.processingTime}ms

OCR情報:
${currentOcrText}

最近のOCR履歴:
${recentOcrResults || '  履歴なし'}
`;
    
    this.detectionStatsElement.textContent = statsText;
  }
  
  drawDebugVisualization(src, detectionResult, stats) {
    if (!this.debugMode) return;
    
    try {
      // 正方形のサイズを取得（setupVideoDisplayと同じロジック）
      const squareSize = Math.min(src.cols, src.rows);
      
      // デバッグキャンバスのサイズを正方形に設定
      this.debugCanvas.width = squareSize;
      this.debugCanvas.height = squareSize;
      
      // 元画像を正方形でトリミングして表示
      const display = new window.cv.Mat();
      
      // 正方形トリミング用の座標を計算
      const cropOffsetX = (src.cols - squareSize) / 2;
      const cropOffsetY = (src.rows - squareSize) / 2;
      
      // 正方形領域を抽出
      const rect = new window.cv.Rect(cropOffsetX, cropOffsetY, squareSize, squareSize);
      const croppedSrc = src.roi(rect);
      
      window.cv.cvtColor(croppedSrc, display, window.cv.COLOR_RGBA2RGB);
      
      croppedSrc.delete();
      
      // スキャン領域を描画
      if (stats.scanRegion) {
        const region = stats.scanRegion;
        const regionColor = new window.cv.Scalar(255, 255, 255, 255); // 白色
        const topLeft = new window.cv.Point(region.x - cropOffsetX, region.y - cropOffsetY);
        const bottomRight = new window.cv.Point(region.x + region.width - cropOffsetX, region.y + region.height - cropOffsetY);
        window.cv.rectangle(display, topLeft, bottomRight, regionColor, 1);
      }
      
      // 検出された垂直線を描画（薄い緑）
      if (stats.detectedLines && stats.detectedLines.length > 0) {
        stats.detectedLines.forEach((line, index) => {
          const color = new window.cv.Scalar(100, 255, 100, 255); // 薄い緑色
          
          // グローバル座標からトリミングオフセットを適用
          const x1 = line.globalX1 - cropOffsetX;
          const y1 = line.globalY1 - cropOffsetY;
          const x2 = line.globalX2 - cropOffsetX;
          const y2 = line.globalY2 - cropOffsetY;
          
          const start = new window.cv.Point(x1, y1);
          const end = new window.cv.Point(x2, y2);
          window.cv.line(display, start, end, color, 1);
          
          // 線の番号を表示
          const centerX = (x1 + x2) / 2;
          const centerY = (y1 + y2) / 2;
          window.cv.putText(display, `${index}`, new window.cv.Point(centerX, centerY), 
            window.cv.FONT_HERSHEY_SIMPLEX, 0.4, color, 1);
        });
      }
      
      // マージされた垂直線を描画（濃い緑）
      if (stats.mergedDetectedLines && stats.mergedDetectedLines.length > 0) {
        stats.mergedDetectedLines.forEach((line, index) => {
          const color = new window.cv.Scalar(0, 255, 0, 255); // 濃い緑色
          
          // グローバル座標からトリミングオフセットを適用
          const x1 = line.globalX1 - cropOffsetX;
          const y1 = line.globalY1 - cropOffsetY;
          const x2 = line.globalX2 - cropOffsetX;
          const y2 = line.globalY2 - cropOffsetY;
          
          const start = new window.cv.Point(x1, y1);
          const end = new window.cv.Point(x2, y2);
          window.cv.line(display, start, end, color, 3);
          
          // 線の番号とマージ数を表示
          const centerX = (x1 + x2) / 2;
          const centerY = (y1 + y2) / 2;
          const label = line.mergedCount ? `M${index}(${line.mergedCount})` : `M${index}`;
          window.cv.putText(display, label, new window.cv.Point(centerX + 5, centerY), 
            window.cv.FONT_HERSHEY_SIMPLEX, 0.5, color, 1);
        });
      }
      
      // 括弧ペア候補を描画
      if (stats.bracketCandidates && stats.bracketCandidates.length > 0) {
        stats.bracketCandidates.forEach((bracket, index) => {
          const color = index === stats.selectedIndex ? 
            new window.cv.Scalar(255, 0, 0, 255) : // 選択された括弧は赤
            new window.cv.Scalar(0, 0, 255, 255);   // その他は青
          
          // 左線（グローバル座標を使用）
          const leftLine = bracket.leftLine;
          const leftStart = new window.cv.Point(leftLine.globalX1 - cropOffsetX, leftLine.globalY1 - cropOffsetY);
          const leftEnd = new window.cv.Point(leftLine.globalX2 - cropOffsetX, leftLine.globalY2 - cropOffsetY);
          window.cv.line(display, leftStart, leftEnd, color, 4);
          
          // 右線（グローバル座標を使用）
          const rightLine = bracket.rightLine;
          const rightStart = new window.cv.Point(rightLine.globalX1 - cropOffsetX, rightLine.globalY1 - cropOffsetY);
          const rightEnd = new window.cv.Point(rightLine.globalX2 - cropOffsetX, rightLine.globalY2 - cropOffsetY);
          window.cv.line(display, rightStart, rightEnd, color, 4);
          
          // 括弧ペアの中心に番号を表示（グローバル座標を使用）
          const centerX = bracket.center.x - cropOffsetX;
          const centerY = bracket.center.y - cropOffsetY;
          window.cv.putText(display, `P${index}`, new window.cv.Point(centerX, centerY), 
            window.cv.FONT_HERSHEY_SIMPLEX, 1, color, 2);
        });
      }
      
      // 最終選択された括弧の仮想矩形を描画
      if (detectionResult.found && detectionResult.corners) {
        const corners = detectionResult.corners;
        const color = new window.cv.Scalar(255, 255, 0, 255); // 黄色
        
        // 仮想矩形の角点を描画（既にグローバル座標なのでトリミングオフセットのみ適用）
        corners.forEach((corner, index) => {
          const adjustedX = corner.x - cropOffsetX;
          const adjustedY = corner.y - cropOffsetY;
          const point = new window.cv.Point(adjustedX, adjustedY);
          window.cv.circle(display, point, 6, color, -1);
          window.cv.putText(display, `${index}`, new window.cv.Point(adjustedX + 10, adjustedY), 
            window.cv.FONT_HERSHEY_SIMPLEX, 0.7, color, 2);
        });
        
        // 仮想矩形を線で描画
        for (let i = 0; i < 4; i++) {
          const start = new window.cv.Point(corners[i].x - cropOffsetX, corners[i].y - cropOffsetY);
          const end = new window.cv.Point(corners[(i + 1) % 4].x - cropOffsetX, corners[(i + 1) % 4].y - cropOffsetY);
          window.cv.line(display, start, end, color, 2);
        }
      }
      
      // 文字領域（上段・下段）を描画
      if (this.currentTextRegions) {
        console.log('文字領域を描画開始:', this.currentTextRegions);
        
        // 文字領域の座標は角度補正後の画像内の座標なので、
        // 元画像座標系に逆変換する必要がある
        if (this.currentTextRegions.isCorrectedCoordinates && detectionResult.found && detectionResult.corners) {
          console.log('角度補正後の座標を逆変換して描画');
          // 角度補正の逆変換を適用して元画像座標系に戻す
          const corners = detectionResult.corners;
          
          // 角度補正時のdstPointsを再計算
          const width = Math.max(
            Math.sqrt(Math.pow(corners[1].x - corners[0].x, 2) + Math.pow(corners[1].y - corners[0].y, 2)),
            Math.sqrt(Math.pow(corners[2].x - corners[3].x, 2) + Math.pow(corners[2].y - corners[3].y, 2))
          );
          const height = Math.max(
            Math.sqrt(Math.pow(corners[3].x - corners[0].x, 2) + Math.pow(corners[3].y - corners[0].y, 2)),
            Math.sqrt(Math.pow(corners[2].x - corners[1].x, 2) + Math.pow(corners[2].y - corners[1].y, 2))
          );
          
          const dstPoints = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, [
            0, 0,           // 左上
            width, 0,       // 右上  
            width, height,  // 右下
            0, height       // 左下
          ]);
          
          const srcPoints = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, [
            corners[0].x, corners[0].y,
            corners[1].x, corners[1].y,
            corners[2].x, corners[2].y,
            corners[3].x, corners[3].y
          ]);
          
          // 逆変換マトリックスを取得
          const inverseTransform = window.cv.getPerspectiveTransform(dstPoints, srcPoints);
          
          // 各文字領域を逆変換
          const transformRegion = (region) => {
            const correctedCorners = [
              [region.x, region.y],
              [region.x + region.width, region.y],
              [region.x + region.width, region.y + region.height],
              [region.x, region.y + region.height]
            ];
            
            const transformedCorners = [];
            for (const corner of correctedCorners) {
              const src = window.cv.matFromArray(1, 1, window.cv.CV_32FC2, corner);
              const dst = new window.cv.Mat();
              window.cv.perspectiveTransform(src, dst, inverseTransform);
              const point = dst.data32F;
              transformedCorners.push({ x: point[0], y: point[1] });
              src.delete();
              dst.delete();
            }
            
            // 変換後の境界ボックスを計算
            const xs = transformedCorners.map(p => p.x);
            const ys = transformedCorners.map(p => p.y);
            return {
              x: Math.min(...xs),
              y: Math.min(...ys),
              width: Math.max(...xs) - Math.min(...xs),
              height: Math.max(...ys) - Math.min(...ys)
            };
          };
          
          // メイン文字領域
          if (this.currentTextRegions.main) {
            const main = transformRegion(this.currentTextRegions.main);
            const mainColor = new window.cv.Scalar(255, 0, 255, 255); // マゼンタ
            const topLeft = new window.cv.Point(main.x - cropOffsetX, main.y - cropOffsetY);
            const bottomRight = new window.cv.Point(main.x + main.width - cropOffsetX, main.y + main.height - cropOffsetY);
            window.cv.rectangle(display, topLeft, bottomRight, mainColor, 2);
            window.cv.putText(display, 'TEXT', new window.cv.Point(main.x - cropOffsetX + 5, main.y - cropOffsetY + 15), 
              window.cv.FONT_HERSHEY_SIMPLEX, 0.5, mainColor, 1);
          }
          
          // 上段領域
          if (this.currentTextRegions.top) {
            const top = transformRegion(this.currentTextRegions.top);
            const topColor = new window.cv.Scalar(255, 255, 0, 255); // シアン
            const topLeft = new window.cv.Point(top.x - cropOffsetX, top.y - cropOffsetY);
            const bottomRight = new window.cv.Point(top.x + top.width - cropOffsetX, top.y + top.height - cropOffsetY);
            window.cv.rectangle(display, topLeft, bottomRight, topColor, 1);
            window.cv.putText(display, 'TOP', new window.cv.Point(top.x - cropOffsetX + 5, top.y - cropOffsetY + 12), 
              window.cv.FONT_HERSHEY_SIMPLEX, 0.4, topColor, 1);
          }
          
          // 下段領域
          if (this.currentTextRegions.bottom) {
            const bottom = transformRegion(this.currentTextRegions.bottom);
            const bottomColor = new window.cv.Scalar(0, 165, 255, 255); // オレンジ
            const topLeft = new window.cv.Point(bottom.x - cropOffsetX, bottom.y - cropOffsetY);
            const bottomRight = new window.cv.Point(bottom.x + bottom.width - cropOffsetX, bottom.y + bottom.height - cropOffsetY);
            window.cv.rectangle(display, topLeft, bottomRight, bottomColor, 1);
            window.cv.putText(display, 'BTM', new window.cv.Point(bottom.x - cropOffsetX + 5, bottom.y - cropOffsetY + 12), 
              window.cv.FONT_HERSHEY_SIMPLEX, 0.4, bottomColor, 1);
          }
          
          // メモリクリーンアップ
          dstPoints.delete();
          srcPoints.delete();
          inverseTransform.delete();
        } else {
          console.log('角度補正なし、または通常座標系での描画');
          
          // フォールバック: 角度補正なしの場合、そのまま描画
          // メイン文字領域
          if (this.currentTextRegions.main) {
            const main = this.currentTextRegions.main;
            const mainColor = new window.cv.Scalar(255, 0, 255, 255); // マゼンタ
            const topLeft = new window.cv.Point(main.x - cropOffsetX, main.y - cropOffsetY);
            const bottomRight = new window.cv.Point(main.x + main.width - cropOffsetX, main.y + main.height - cropOffsetY);
            window.cv.rectangle(display, topLeft, bottomRight, mainColor, 2);
            window.cv.putText(display, 'TEXT', new window.cv.Point(main.x - cropOffsetX + 5, main.y - cropOffsetY + 15), 
              window.cv.FONT_HERSHEY_SIMPLEX, 0.5, mainColor, 1);
          }
          
          // 上段領域
          if (this.currentTextRegions.top) {
            const top = this.currentTextRegions.top;
            const topColor = new window.cv.Scalar(255, 255, 0, 255); // シアン
            const topLeft = new window.cv.Point(top.x - cropOffsetX, top.y - cropOffsetY);
            const bottomRight = new window.cv.Point(top.x + top.width - cropOffsetX, top.y + top.height - cropOffsetY);
            window.cv.rectangle(display, topLeft, bottomRight, topColor, 1);
            window.cv.putText(display, 'TOP', new window.cv.Point(top.x - cropOffsetX + 5, top.y - cropOffsetY + 12), 
              window.cv.FONT_HERSHEY_SIMPLEX, 0.4, topColor, 1);
          }
          
          // 下段領域
          if (this.currentTextRegions.bottom) {
            const bottom = this.currentTextRegions.bottom;
            const bottomColor = new window.cv.Scalar(0, 165, 255, 255); // オレンジ
            const topLeft = new window.cv.Point(bottom.x - cropOffsetX, bottom.y - cropOffsetY);
            const bottomRight = new window.cv.Point(bottom.x + bottom.width - cropOffsetX, bottom.y + bottom.height - cropOffsetY);
            window.cv.rectangle(display, topLeft, bottomRight, bottomColor, 1);
            window.cv.putText(display, 'BTM', new window.cv.Point(bottom.x - cropOffsetX + 5, bottom.y - cropOffsetY + 12), 
              window.cv.FONT_HERSHEY_SIMPLEX, 0.4, bottomColor, 1);
          }
        }
      }
      
      // エッジ検出結果を重ねて表示
      if (this.currentEdgeDetection) {
        try {
          // エッジ検出結果を緑色で重ねて描画
          if (this.currentEdgeDetection.edges) {
            const edgesMask = new window.cv.Mat();
            const edgesColored = new window.cv.Mat();
            
            // エッジを3チャンネルに変換
            window.cv.cvtColor(this.currentEdgeDetection.edges, edgesColored, window.cv.COLOR_GRAY2RGB);
            
            // エッジ部分を緑色に変更
            const greenColor = new window.cv.Scalar(0, 255, 0);
            const mask = new window.cv.Mat();
            window.cv.threshold(this.currentEdgeDetection.edges, mask, 127, 255, window.cv.THRESH_BINARY);
            edgesColored.setTo(greenColor, mask);
            
            // 元画像に半透明で重ねる
            const alpha = 0.3; // 透明度
            const beta = 1 - alpha;
            window.cv.addWeighted(display, beta, edgesColored, alpha, 0, display);
            
            // メモリクリーンアップ
            edgesMask.delete();
            edgesColored.delete();
            mask.delete();
          }
          
          // 膨張結果を青色で重ねて描画
          if (this.currentEdgeDetection.dilated) {
            const dilatedColored = new window.cv.Mat();
            
            // 膨張結果を3チャンネルに変換
            window.cv.cvtColor(this.currentEdgeDetection.dilated, dilatedColored, window.cv.COLOR_GRAY2RGB);
            
            // 膨張部分を青色に変更
            const blueColor = new window.cv.Scalar(255, 0, 0);
            const mask = new window.cv.Mat();
            window.cv.threshold(this.currentEdgeDetection.dilated, mask, 127, 255, window.cv.THRESH_BINARY);
            dilatedColored.setTo(blueColor, mask);
            
            // 元画像に半透明で重ねる
            const alpha = 0.2; // より薄く表示
            const beta = 1 - alpha;
            window.cv.addWeighted(display, beta, dilatedColored, alpha, 0, display);
            
            // メモリクリーンアップ
            dilatedColored.delete();
            mask.delete();
          }
          
        } catch (error) {
          console.error('エッジ検出結果の描画エラー:', error);
        }
      }
      
      // デバッグキャンバスに描画
      window.cv.imshow(this.debugCanvas, display);
      
      // メモリクリーンアップ
      display.delete();
      
    } catch (error) {
      console.error('デバッグ可視化エラー:', error);
    }
  }

  mergeCloseLines(lines) {
    if (lines.length === 0) return [];
    
    console.log(`=== 線分マージ開始: ${lines.length}本の線を処理 ===`);
    
    const mergedLines = [];
    const used = new Set();
    const mergeDistance = 25; // 25px以内の線をマージ（15→25に緩和）
    const angleThreshold = 15; // 15度以内の角度差（10→15に緩和）
    
    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue;
      
      const currentLine = lines[i];
      const similarLines = [currentLine];
      used.add(i);
      
      console.log(`線 ${i}: 中心(${currentLine.centerX.toFixed(1)}, ${currentLine.centerY.toFixed(1)}), 長さ=${currentLine.length.toFixed(1)}, 角度=${currentLine.angle.toFixed(1)}°`);
      
      // 類似した線を見つける
      for (let j = i + 1; j < lines.length; j++) {
        if (used.has(j)) continue;
        
        const otherLine = lines[j];
        
        // 水平距離の判定
        const horizontalDistance = Math.abs(currentLine.centerX - otherLine.centerX);
        
        // 角度の差の判定
        const angleDiff = Math.abs(currentLine.angle - otherLine.angle);
        
        // 垂直位置の重複チェック
        const minY1 = Math.min(currentLine.y1, currentLine.y2);
        const maxY1 = Math.max(currentLine.y1, currentLine.y2);
        const minY2 = Math.min(otherLine.y1, otherLine.y2);
        const maxY2 = Math.max(otherLine.y1, otherLine.y2);
        
        const verticalOverlap = Math.min(maxY1, maxY2) - Math.max(minY1, minY2);
        
        console.log(`  vs 線 ${j}: 距離=${horizontalDistance.toFixed(1)}, 角度差=${angleDiff.toFixed(1)}°, 重複=${verticalOverlap.toFixed(1)}`);
        
        // マージ条件: 近い水平位置、類似角度、垂直重複または近接
        // 垂直重複がなくても、線が近ければマージ対象とする
        const verticalGap = Math.max(minY1, minY2) - Math.min(maxY1, maxY2);
        const allowVerticalGap = 20; // 20px以内の縦方向ギャップも許容
        
        if (horizontalDistance < mergeDistance && 
            angleDiff < angleThreshold && 
            (verticalOverlap > 0 || verticalGap < allowVerticalGap)) {
          
          similarLines.push(otherLine);
          used.add(j);
          
          const conditionMet = verticalOverlap > 0 ? `重複=${verticalOverlap.toFixed(1)}` : `ギャップ=${verticalGap.toFixed(1)} < ${allowVerticalGap}`;
          console.log(`    ✓ マージ対象に追加: 距離=${horizontalDistance.toFixed(1)} < ${mergeDistance}, 角度差=${angleDiff.toFixed(1)}° < ${angleThreshold}°, ${conditionMet}`);
        } else {
          console.log(`    ✗ マージ条件未満: 距離=${horizontalDistance >= mergeDistance ? 'NG' : 'OK'}, 角度=${angleDiff >= angleThreshold ? 'NG' : 'OK'}, 垂直=${verticalOverlap <= 0 && verticalGap >= allowVerticalGap ? 'NG' : 'OK'}`);
        }
      }
      
      // 類似した線から代表線を作成
      if (similarLines.length > 1) {
        const mergedLine = this.createMergedLine(similarLines);
        mergedLines.push(mergedLine);
        console.log(`  ${similarLines.length}本の線をマージして1本に統合`);
      } else {
        mergedLines.push(currentLine);
      }
    }
    
    return mergedLines;
  }
  
  createMergedLine(lines) {
    // 最も長い線を基準として使用
    const longestLine = lines.reduce((longest, line) => 
      line.length > longest.length ? line : longest
    );
    
    // 重心で平均位置を計算
    const avgCenterX = lines.reduce((sum, line) => sum + line.centerX, 0) / lines.length;
    
    // Y座標の範囲を統合（最も広い範囲を取る）
    const allY = lines.flatMap(line => [line.y1, line.y2]);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);
    
    // 統合された線の長さ
    const mergedLength = maxY - minY;
    
    return {
      x1: avgCenterX,
      y1: minY,
      x2: avgCenterX,
      y2: maxY,
      centerX: avgCenterX,
      centerY: (minY + maxY) / 2,
      length: mergedLength,
      angle: longestLine.angle,
      // グローバル座標も更新
      globalX1: avgCenterX + (longestLine.globalX1 - longestLine.x1),
      globalY1: minY + (longestLine.globalY1 - longestLine.y1),
      globalX2: avgCenterX + (longestLine.globalX2 - longestLine.x2),
      globalY2: maxY + (longestLine.globalY2 - longestLine.y2),
      globalCenterX: avgCenterX + (longestLine.globalCenterX - longestLine.centerX),
      globalCenterY: (minY + maxY) / 2 + (longestLine.globalCenterY - longestLine.centerY),
      mergedCount: lines.length
    };
  }
}

// DOM読み込み完了後にアプリケーションを初期化
document.addEventListener('DOMContentLoaded', () => {
  const scanner = new MameComicScanner();
  
  // ページを離れる際のクリーンアップ
  window.addEventListener('beforeunload', async () => {
    await scanner.cleanup();
  });
}); 