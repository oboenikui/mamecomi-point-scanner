/* eslint-env browser */
/* global setInterval, clearInterval */

// まめコミポイントスキャナー - メインスクリプト

class MameComicScanner {
  constructor() {
    this.video = document.getElementById('video');
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.stream = null;
    this.opencvReady = false;
    this.tesseractWorker = null;
    this.scanningInterval = null;
    
    // スキャナーの状態
    this.state = 'waiting'; // 'waiting', 'scanning', 'completed'
    
    // ボタン要素
    this.startScanButton = document.getElementById('start-scan');
    this.rescanButton = document.getElementById('rescan');
    this.copyButton = document.getElementById('copy-button');
    
    // ステータス表示
    this.statusElement = document.getElementById('status');
    this.scannedCodeElement = document.getElementById('scanned-code');
    this.codeTextElement = document.getElementById('code-text');
    
    this.initializeEventListeners();
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
        tessedit_char_whitelist: 'ACEFGHJKLMNPRTWXY0123456789[]',
        tessedit_pageseg_mode: '6', // Uniform block of text
        tessedit_ocr_engine_mode: '1' // Neural nets LSTM engine only
      });
      
      this.updateStatus('準備完了: スキャンを開始してください');
      console.log('ライブラリが正常に読み込まれました');
      
    } catch (error) {
      console.error('OCRエンジンの初期化エラー:', error);
      this.updateStatus('OCRエンジンの初期化に失敗しました');
    }
  }
  
  initializeEventListeners() {
    this.startScanButton.addEventListener('click', () => this.startScanning());
    this.rescanButton.addEventListener('click', () => this.startScanning());
    this.copyButton.addEventListener('click', () => this.copyToClipboard());
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
      
      const constraints = {
        video: {
          facingMode: 'environment', // 背面カメラを優先
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;
      
      this.video.onloadedmetadata = () => {
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        this.beginContinuousScanning();
      };
      
    } catch (error) {
      console.error('カメラのアクセスエラー:', error);
      this.updateStatus('カメラにアクセスできませんでした。ブラウザでカメラの許可を与えてください。');
      this.setState('waiting');
    }
  }
  
  beginContinuousScanning() {
    this.updateStatus('スキャン中... マーカーを枠内に合わせてください');
    
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
      // キャンバスに現在のビデオフレームを描画
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      
      // OpenCVで画像処理とOCR
      const scannedText = await this.processImageWithOpenCV();
      
      if (scannedText && scannedText.trim()) {
        // マーカーが検出されたらスキャン完了
        this.onScanCompleted(scannedText.trim());
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
  
  async processImageWithOpenCV() {
    try {
      // キャンバスからOpenCV Matオブジェクトを作成
      const src = window.cv.imread(this.canvas);
      
      // スキャンフレーム領域を抽出（画面中央の200x60px領域）
      const scanRegion = this.extractScanRegion(src);
      
      // 画像前処理でOCR精度を向上
      const preprocessed = this.preprocessForOCR(scanRegion);
      
      // OCR処理
      const result = await this.performOCR(preprocessed);
      
      // メモリクリーンアップ
      src.delete();
      scanRegion.delete();
      preprocessed.delete();
      
      return result;
      
    } catch (error) {
      console.error('OpenCV処理エラー:', error);
      return null;
    }
  }
  
  extractScanRegion(src) {
    // 画面中央の132x108px領域を抽出（スキャンフレームに対応）
    // 実際の寸法: 横11mm × 縦9mm
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
      // OpenCV MatをCanvasに描画
      const tempCanvas = document.createElement('canvas');
      window.cv.imshow(tempCanvas, processedImage);
      
      // Tesseract.jsでOCR実行
      const { data: { text } } = await this.tesseractWorker.recognize(tempCanvas);
      
      // 結果を検証・整形
      const formattedCode = this.validateAndFormatCode(text);
      
      return formattedCode;
      
    } catch (error) {
      console.error('OCR実行エラー:', error);
      return null;
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
      
      // 禁止文字（B、D、I、O、Q、S、U、V、Z）が含まれていないかチェック
      const forbiddenChars = /[BDIOQSUVZ]/;
      if (!forbiddenChars.test(code)) {
        return code;
      }
    }
    
    // より柔軟なパターンマッチング（括弧が認識されない場合）
    const flexiblePattern = /([ACEFGHJKLMNPRTWXY0123456789]{16})/;
    const flexibleMatch = cleanText.match(flexiblePattern);
    
    if (flexibleMatch) {
      const code = flexibleMatch[1];
      const forbiddenChars = /[BDIOQSUVZ]/;
      if (!forbiddenChars.test(code)) {
        return code;
      }
    }
    
    return null;
  }
  

  
  displayScannedCode(code) {
    this.codeTextElement.textContent = code;
    this.scannedCodeElement.style.display = 'block';
  }
  
  async copyToClipboard() {
    const code = this.codeTextElement.textContent;
    
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
}

// DOM読み込み完了後にアプリケーションを初期化
document.addEventListener('DOMContentLoaded', () => {
  const scanner = new MameComicScanner();
  
  // ページを離れる際のクリーンアップ
  window.addEventListener('beforeunload', async () => {
    await scanner.cleanup();
  });
}); 