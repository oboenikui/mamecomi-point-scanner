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
    this.updateStatus('OpenCVライブラリを読み込み中...');
    
    if (typeof window.cv !== 'undefined') {
      this.onOpenCVReady();
    } else {
      // OpenCVが読み込まれるまで待機
      const checkOpenCV = () => {
        if (typeof window.cv !== 'undefined') {
          this.onOpenCVReady();
        } else {
          setTimeout(checkOpenCV, 100);
        }
      };
      setTimeout(checkOpenCV, 100);
    }
  }
  
  onOpenCVReady() {
    this.opencvReady = true;
    this.updateStatus('準備完了: スキャンを開始してください');
    console.log('OpenCV.js が正常に読み込まれました');
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
  
  performScan() {
    if (!this.opencvReady || this.state !== 'scanning') {
      return;
    }
    
    try {
      // キャンバスに現在のビデオフレームを描画
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      
      // OpenCVで画像処理
      const scannedText = this.processImageWithOpenCV();
      
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
  
  processImageWithOpenCV() {
    try {
      // キャンバスからOpenCV Matオブジェクトを作成
      const src = window.cv.imread(this.canvas);
      const gray = new window.cv.Mat();
      const binary = new window.cv.Mat();
      
      // グレースケールに変換
      window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);
      
      // 二値化でテキスト部分を強調
      window.cv.threshold(gray, binary, 0, 255, window.cv.THRESH_BINARY + window.cv.THRESH_OTSU);
      
      // 簡単なOCR処理（実際の実装では外部ライブラリが必要）
      // ここでは仮の実装として、画像の特徴から推定
      const result = this.simpleTextRecognition(binary);
      
      // メモリクリーンアップ
      src.delete();
      gray.delete();
      binary.delete();
      
      return result;
      
    } catch (error) {
      console.error('OpenCV処理エラー:', error);
      return null;
    }
  }
  
  simpleTextRecognition(_binaryMat) {
    // 実際のOCR実装では Tesseract.js などを使用
    // ここでは簡易的なシミュレーション
    
    // 画像の中央部分を分析
    // 実際の実装では、この部分でより精密な文字認識を行う
    // 現在は開発用として、10%の確率でダミーコードを返す（マーカー検出のシミュレーション）
    if (Math.random() < 0.1) { // 10%の確率で「検出」
      const dummyCodes = [
        'ABC123DEF456',
        'XYZ789GHI012',
        'MNO345PQR678',
        'STU901VWX234'
      ];
      return dummyCodes[Math.floor(Math.random() * dummyCodes.length)];
    }
    
    return null; // マーカー未検出
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
  new MameComicScanner();
}); 