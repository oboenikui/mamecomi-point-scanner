/* eslint-env browser */
/* global cv */

// まめコミポイントスキャナー - メインスクリプト

class MameComicScanner {
  constructor() {
    this.video = document.getElementById('video');
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.stream = null;
    this.opencvReady = false;
    
    // ボタン要素
    this.startButton = document.getElementById('start-camera');
    this.captureButton = document.getElementById('capture');
    this.stopButton = document.getElementById('stop-camera');
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
    this.updateStatus('準備完了: カメラを開始してください');
    console.log('OpenCV.js が正常に読み込まれました');
  }
  
  initializeEventListeners() {
    this.startButton.addEventListener('click', () => this.startCamera());
    this.captureButton.addEventListener('click', () => this.captureAndScan());
    this.stopButton.addEventListener('click', () => this.stopCamera());
    this.copyButton.addEventListener('click', () => this.copyToClipboard());
  }
  
  async startCamera() {
    try {
      this.updateStatus('カメラにアクセス中...');
      
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
        
        this.startButton.disabled = true;
        this.captureButton.disabled = false;
        this.stopButton.disabled = false;
        
        this.updateStatus('カメラが起動しました。シリアルコードを枠内に合わせてスキャンボタンを押してください');
      };
      
    } catch (error) {
      console.error('カメラのアクセスエラー:', error);
      this.updateStatus('カメラにアクセスできませんでした。ブラウザでカメラの許可を与えてください。');
    }
  }
  
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    this.video.srcObject = null;
    this.startButton.disabled = false;
    this.captureButton.disabled = true;
    this.stopButton.disabled = true;
    
    this.updateStatus('カメラを停止しました');
  }
  
  captureAndScan() {
    if (!this.opencvReady) {
      this.updateStatus('OpenCVがまだ準備できていません');
      return;
    }
    
    try {
      this.updateStatus('画像を処理中...');
      
      // キャンバスに現在のビデオフレームを描画
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      
      // OpenCVで画像処理
      const scannedText = this.processImageWithOpenCV();
      
      if (scannedText && scannedText.trim()) {
        this.displayScannedCode(scannedText.trim());
        this.updateStatus('スキャン完了!');
      } else {
        this.updateStatus('シリアルコードが見つかりませんでした。再度お試しください。');
      }
      
    } catch (error) {
      console.error('スキャンエラー:', error);
      this.updateStatus('スキャン中にエラーが発生しました');
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
      
      // デバッグ用: 処理後の画像をキャンバスに表示
      window.cv.imshow(this.canvas, binary);
      
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
  
  simpleTextRecognition(binaryMat) {
    // 実際のOCR実装では Tesseract.js などを使用
    // ここでは簡易的なシミュレーション
    
    // 画像の中央部分を分析
    const centerRect = {
      x: Math.floor(binaryMat.cols * 0.3),
      y: Math.floor(binaryMat.rows * 0.4),
      width: Math.floor(binaryMat.cols * 0.4),
      height: Math.floor(binaryMat.rows * 0.2)
    };
    
    // 実際の実装では、この部分でより精密な文字認識を行う
    // 現在は開発用のダミーコードを返す
    const dummyCodes = [
      'ABC123DEF456',
      'XYZ789GHI012',
      'MNO345PQR678',
      'STU901VWX234'
    ];
    
    // ランダムにサンプルコードを返す（実際の実装では画像解析結果）
    return dummyCodes[Math.floor(Math.random() * dummyCodes.length)];
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