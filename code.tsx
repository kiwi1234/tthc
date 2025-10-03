import React, { useState, useCallback, useEffect } from 'react';

const PublicServicePortal = () => {
  const [currentView, setCurrentView] = useState('home');
  const [submissionData, setSubmissionData] = useState({
    fullName: '',
    phoneNumber: '',
    idNumber: '',
    serviceType: '',
    files: [] as File[]
  });
  const [trackingCode, setTrackingCode] = useState('');
  const [trackingCCCD, setTrackingCCCD] = useState('');
  const [submissionResult, setSubmissionResult] = useState({
    code: '',
    status: '',
    message: '',
    adminNote: ''
  });
  const [applications, setApplications] = useState<any[]>([]);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [adminNote, setAdminNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState<string | null>(null);
  const [searchCCCD, setSearchCCCD] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Load applications from localStorage on component mount
  useEffect(() => {
    const savedApplications = localStorage.getItem('applications');
    if (savedApplications) {
      setApplications(JSON.parse(savedApplications));
    }
  }, []);

  // Save applications to localStorage whenever applications change
  useEffect(() => {
    localStorage.setItem('applications', JSON.stringify(applications));
  }, [applications]);

  const handleSubmitApplication = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!submissionData.fullName || !submissionData.phoneNumber || !submissionData.idNumber || !submissionData.serviceType) {
      alert('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    // Generate random application code with timestamp
    const timestamp = Date.now().toString().slice(-4);
    const randomCode = 'HS' + Math.floor(100000 + Math.random() * 900000) + timestamp;
    
    // Convert files to base64 for storage
    const filePromises = submissionData.files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          name: file.name,
          size: file.size,
          type: file.type,
          data: reader.result
        });
        reader.readAsDataURL(file);
      });
    });

    Promise.all(filePromises).then((fileData) => {
      // Generate sequential order number
      const orderNumber = applications.length + 1;
      
      // Save application to database (localStorage)
      const newApplication = {
        orderNumber: orderNumber,
        code: randomCode,
        fullName: submissionData.fullName,
        phoneNumber: submissionData.phoneNumber,
        idNumber: submissionData.idNumber,
        serviceType: submissionData.serviceType,
        files: fileData,
        status: 'pending',
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null
      };

      setApplications(prev => [...prev, newApplication]);

      setSubmissionResult({
        code: randomCode,
        status: 'received',
        message: 'Hồ sơ đã tiếp nhận thành công. Học sinh/PHHS tra cứu bằng mã đã cấp để biết trạng thái hồ sơ.',
        adminNote: ''
      });
      
      // Reset form data
      setSubmissionData({
        fullName: '',
        phoneNumber: '',
        idNumber: '',
        serviceType: '',
        files: []
      });
      
      setCurrentView('confirmation');
    });
  }, [submissionData]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      
      // Validate file size (max 10MB per file)
      const oversizedFiles = filesArray.filter(file => file.size > 10 * 1024 * 1024);
      if (oversizedFiles.length > 0) {
        alert('Một số file vượt quá kích thước cho phép (10MB/file). Vui lòng chọn lại.');
        return;
      }
      
      // Validate file types (only images)
      const invalidFiles = filesArray.filter(file => !file.type.startsWith('image/'));
      if (invalidFiles.length > 0) {
        alert('Chỉ hỗ trợ file ảnh (JPG, JPEG, PNG). Vui lòng chọn lại.');
        return;
      }
      
      setSubmissionData(prev => ({
        ...prev,
        files: [...prev.files, ...filesArray]
      }));
    }
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setSubmissionData(prev => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index)
    }));
  }, []);

  const handleTrackApplication = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (!trackingCode.trim()) {
      alert('Vui lòng nhập mã hồ sơ');
      return;
    }
    
    // Validate tracking code format (HS followed by numbers)
    if (!/^HS\d{6,10}$/.test(trackingCode)) {
      alert('Mã hồ sơ không đúng định dạng. Vui lòng kiểm tra lại.');
      return;
    }

    // Find application from database by code or CCCD
    const application = applications.find(app => 
      app.code === trackingCode || app.idNumber === trackingCode
    );
    
    if (!application) {
      alert('Không tìm thấy hồ sơ với thông tin này. Vui lòng kiểm tra lại.');
      return;
    }

    const statusMessages = {
      pending: 'Hồ sơ đang chờ tiếp nhận. Bộ phận giáo vụ sẽ xử lý trong vòng 01 buổi.',
      processing: 'Hồ sơ đang được xử lý. Dự kiến hoàn thành trong 01 buổi làm việc.',
      needs_more_info: application.adminNote || 'Hồ sơ cần bổ sung thông tin. Vui lòng kiểm tra bằng cách tra cứu hoặc liên hệ bộ phận giáo vụ để biết chi tiết.',
      completed: 'Hồ sơ đã hoàn tất. Quý phụ huynh có thể đến trường nhận kết quả từ theo thời gian như sau.'
    };
    
    setSubmissionResult({
      code: trackingCode,
      status: application.status,
      message: statusMessages[application.status as keyof typeof statusMessages],
      adminNote: application.adminNote
    });
    
    setTrackingCode('');
    setCurrentView('tracking-result');
  }, [trackingCode, applications]);

  const handleUpdateApplication = useCallback(() => {
    const application = applications.find(app => app.code === submissionResult.code);
    if (application) {
      // Pre-fill the form with existing data (without files for now)
      setSubmissionData({
        fullName: application.fullName,
        phoneNumber: application.phoneNumber,
        idNumber: application.idNumber,
        serviceType: application.serviceType,
        files: []
      });
      setCurrentView('submit-form');
    }
  }, [applications, submissionResult.code]);

  const handleAdminLogin = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'Ptdn@2024#Secure!') {
      setIsAdminAuthenticated(true);
      setCurrentView('admin-dashboard');
      setAdminPassword('');
    } else {
      alert('Mật khẩu không đúng. Vui lòng thử lại.');
    }
  }, [adminPassword]);

  const handleStatusUpdate = useCallback((applicationCode: string, newStatus: string) => {
    if (newStatus === 'needs_more_info') {
      setShowNoteInput(applicationCode);
      return;
    }
    
    setApplications(prev => 
      prev.map(app => 
        app.code === applicationCode 
          ? { 
              ...app, 
              status: newStatus, 
              updatedAt: new Date().toISOString(),
              completedAt: newStatus === 'completed' ? new Date().toISOString() : app.completedAt
            }
          : app
      )
    );
  }, []);

  const handleSaveAdminNote = useCallback((applicationCode: string) => {
    if (!adminNote.trim()) {
      alert('Vui lòng nhập ghi chú cho học sinh/phụ huynh biết cần bổ sung thông tin gì');
      return;
    }

    setApplications(prev => 
      prev.map(app => 
        app.code === applicationCode 
          ? { 
              ...app, 
              status: 'needs_more_info', 
              adminNote: adminNote,
              updatedAt: new Date().toISOString()
            }
          : app
      )
    );
    
    setAdminNote('');
    setShowNoteInput(null);
  }, [adminNote]);

  const handleCancelNote = useCallback(() => {
    setAdminNote('');
    setShowNoteInput(null);
  }, []);

  const handleToggleReceived = useCallback((applicationCode: string) => {
    setApplications(prev => 
      prev.map(app => 
        app.code === applicationCode 
          ? { 
              ...app, 
              isReceived: !app.isReceived,
              receivedAt: !app.isReceived ? new Date().toISOString() : null,
              updatedAt: new Date().toISOString()
            }
          : app
      )
    );
  }, []);

  const filteredApplications = searchCCCD.trim() 
    ? applications.filter(app => app.idNumber.includes(searchCCCD.trim()))
    : applications;

  const exportToExcel = useCallback(() => {
    // Create CSV content
    const headers = ['STT', 'Mã Hồ Sơ', 'Họ Tên', 'Số CCCD', 'Số ĐT', 'Loại Thủ Tục', 'Trạng Thái', 'Đã Nhận', 'Thời Gian Nộp', 'Thời Gian Hoàn Thành', 'Ghi Chú Admin'];
    
    const csvData = applications.map(app => [
      app.orderNumber || '',
      app.code || '',
      app.fullName || '',
      app.idNumber || '',
      app.phoneNumber || '',
      app.serviceType === 'withdraw_documents' ? 'Thủ tục rút hồ sơ/học bạ' :
      app.serviceType === 'academic_certificate' ? 'Thủ tục cấp giấy xác nhận kết quả học tập THPT' :
      app.serviceType === 'academic_process' ? 'Thủ tục cấp giấy xác nhận quá trình học tập' :
      app.serviceType === 'transfer_out' ? 'Thủ tục chuyển trường đi' :
      app.serviceType === 'enrollment_confirmation' ? 'Thủ tục xác nhận đang học tại trường' :
      app.serviceType === 'graduation_certificate' ? 'Thủ tục rút bằng tốt nghiệp THPT' :
      app.serviceType === 'program_completion' ? 'Thủ tục xác nhận hoàn thành chương trình THPT' :
      app.serviceType === 'temp_graduation_certificate' ? 'Thủ tục cấp lại giấy chứng nhận tốt nghiệp (tạm thời)' : 'Thủ tục khác',
      app.status === 'pending' ? 'Chờ xử lý' :
      app.status === 'processing' ? 'Đang xử lý' :
      app.status === 'needs_more_info' ? 'Cần bổ sung' : 'Hoàn thành',
      app.isReceived ? 'Đã nhận' : 'Chưa nhận',
      app.submittedAt ? new Date(app.submittedAt).toLocaleString('vi-VN') : '',
      app.completedAt ? new Date(app.completedAt).toLocaleString('vi-VN') : '',
      app.adminNote || ''
    ]);

    // Convert to CSV format
    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    // Add BOM for Vietnamese characters
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;

    // Create and download file
    const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `danh_sach_ho_so_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [applications]);

  const handleLogout = useCallback(() => {
    setIsAdminAuthenticated(false);
    setCurrentView('home');
  }, []);

  const renderHomeView = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-6 sm:py-8 md:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6 sm:mb-8 md:mb-12">
          <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-gray-900 mb-3 sm:mb-4 leading-tight px-2">
            QUY TRÌNH GIẢI QUYẾT THỦ TỤC HÀNH CHÍNH TẠI TRƯỜNG PHỔ THÔNG DÂN TỘC NỘI TRÚ
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-gray-600 px-2">
            Nộp hồ sơ và tra cứu tiến độ không cần đăng nhập
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Submit Application Card */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-5 sm:p-6 md:p-8 hover:shadow-xl transition-shadow">
            <div className="text-center mb-4 sm:mb-6">
              <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <svg className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 mb-2">Nộp Hồ Sơ</h3>
              <p className="text-xs sm:text-sm md:text-base text-gray-600">Gửi hồ sơ trực tuyến nhanh chóng và tiện lợi</p>
            </div>
            <button
              onClick={() => setCurrentView('submit-form')}
              className="w-full bg-blue-600 text-white py-3 px-4 sm:px-6 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-medium text-sm sm:text-base min-h-[44px] touch-manipulation"
            >
              Bắt Đầu Nộp Hồ Sơ
            </button>
          </div>

          {/* Track Application Card */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-5 sm:p-6 md:p-8 hover:shadow-xl transition-shadow">
            <div className="text-center mb-4 sm:mb-6">
              <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <svg className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 mb-2">Tra Cứu Tiến Độ</h3>
              <p className="text-xs sm:text-sm md:text-base text-gray-600">Theo dõi trạng thái hồ sơ đã nộp</p>
            </div>
            <button
              onClick={() => setCurrentView('track-form')}
              className="w-full bg-green-600 text-white py-3 px-4 sm:px-6 rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors font-medium text-sm sm:text-base min-h-[44px] touch-manipulation"
            >
              Tra Cứu Ngay
            </button>
          </div>

          {/* Admin Panel Card */}
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-5 sm:p-6 md:p-8 hover:shadow-xl transition-shadow sm:col-span-2 lg:col-span-1">
            <div className="text-center mb-4 sm:mb-6">
              <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <svg className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 mb-2">Quản Trị</h3>
              <p className="text-xs sm:text-sm md:text-base text-gray-600">Quản lý hồ sơ và cập nhật trạng thái</p>
            </div>
            <button
              onClick={() => setCurrentView('admin-login')}
              className="w-full bg-purple-600 text-white py-3 px-4 sm:px-6 rounded-lg hover:bg-purple-700 active:bg-purple-800 transition-colors font-medium text-sm sm:text-base min-h-[44px] touch-manipulation"
            >
              Đăng Nhập Admin
            </button>
          </div>
        </div>

        {/* Process Steps Infographic */}
        <div className="mt-8 sm:mt-12 lg:mt-16 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 lg:p-8 border border-blue-200">
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-center text-gray-900 mb-6 sm:mb-8 md:mb-12">Quy Trình 4 Bước Đơn Giản</h2>
          
          <div className="relative">
            {/* Flow Line - Hidden on mobile */}
            <div className="hidden lg:block absolute top-16 left-0 right-0 h-1">
              <div className="flex justify-between items-center h-full max-w-4xl mx-auto px-24">
                <div className="flex-1 h-1 bg-gradient-to-r from-blue-600 to-green-600 rounded-full"></div>
                <div className="w-4 h-4 bg-blue-600 rounded-full mx-4"></div>
                <div className="flex-1 h-1 bg-gradient-to-r from-blue-600 to-green-600 rounded-full"></div>
                <div className="w-4 h-4 bg-blue-600 rounded-full mx-4"></div>
                <div className="flex-1 h-1 bg-gradient-to-r from-blue-600 to-green-600 rounded-full"></div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 relative z-10">
              {/* Step 1 */}
              <div className="text-center group">
                <div className="relative mb-4 sm:mb-6">
                  <div className="w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 text-xl sm:text-2xl font-bold shadow-lg group-hover:scale-110 transition-transform">
                    1
                  </div>
                  <div className="absolute inset-0 w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 bg-blue-200 rounded-full mx-auto animate-pulse opacity-0 group-hover:opacity-30"></div>
                </div>
                <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-md border-2 border-blue-100 hover:border-blue-300 transition-colors">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-blue-900 mb-1 sm:mb-2 text-sm sm:text-base md:text-lg">Chuẩn Bị</h4>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">Chọn loại thủ tục cần giải quyết và chuẩn bị đầy đủ hồ sơ giấy tờ cần thiết</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="text-center group">
                <div className="relative mb-4 sm:mb-6">
                  <div className="w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 text-xl sm:text-2xl font-bold shadow-lg group-hover:scale-110 transition-transform">
                    2
                  </div>
                  <div className="absolute inset-0 w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 bg-green-200 rounded-full mx-auto animate-pulse opacity-0 group-hover:opacity-30"></div>
                </div>
                <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-md border-2 border-green-100 hover:border-green-300 transition-colors">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-green-900 mb-1 sm:mb-2 text-sm sm:text-base md:text-lg">Nộp Hồ Sơ</h4>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">Điền thông tin vào form trực tuyến và upload file scan hồ sơ đã chuẩn bị</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="text-center group">
                <div className="relative mb-4 sm:mb-6">
                  <div className="w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 bg-gradient-to-r from-yellow-500 to-orange-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 text-xl sm:text-2xl font-bold shadow-lg group-hover:scale-110 transition-transform">
                    3
                  </div>
                  <div className="absolute inset-0 w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 bg-yellow-200 rounded-full mx-auto animate-pulse opacity-0 group-hover:opacity-30"></div>
                </div>
                <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-md border-2 border-yellow-100 hover:border-yellow-300 transition-colors">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-yellow-900 mb-1 sm:mb-2 text-sm sm:text-base md:text-lg">Xử Lý</h4>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">Bộ phận giáo vụ tiếp nhận, kiểm tra và xử lý hồ sơ trong vòng 01 buổi</p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="text-center group">
                <div className="relative mb-4 sm:mb-6">
                  <div className="w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 text-xl sm:text-2xl font-bold shadow-lg group-hover:scale-110 transition-transform">
                    4
                  </div>
                  <div className="absolute inset-0 w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 bg-purple-200 rounded-full mx-auto animate-pulse opacity-0 group-hover:opacity-30"></div>
                </div>
                <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-md border-2 border-purple-100 hover:border-purple-300 transition-colors">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2 sm:mb-3">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-purple-900 mb-1 sm:mb-2 text-sm sm:text-base md:text-lg">Kiểm Tra & Nhận Kết Quả</h4>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">Tra cứu tiến độ bằng mã hồ sơ và xem thông tin thời gian nhận kết quả</p>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-8 sm:mt-10 md:mt-12 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-blue-500">
                <div className="flex items-start">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-900 mb-2">Thời Gian Xử Lý</h5>
                    <p className="text-sm text-gray-600">Hầu hết hồ sơ được xử lý trong vòng 01 buổi làm việc. Kết quả học sinh/PHHS xem tại phần tra cứu tiến độ</p>
>>>>>>>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-green-500">
                <div className="flex items-start">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <h5 className="font-semibold text-gray-900 mb-2">Bảo Mật Thông Tin</h5>
                    <p className="text-sm text-gray-600">Tất cả thông tin cá nhân và file đính kèm được bảo mật tuyệt đối theo quy định.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        
      </div>
    </div>
  );

  const renderSubmitForm = () => (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-8 md:py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-5 sm:p-6 md:p-8">
          <div className="flex items-center mb-4 sm:mb-6">
            <button
              onClick={() => setCurrentView('home')}
              className="flex items-center text-blue-600 hover:text-blue-800 mr-3 sm:mr-4 min-h-[44px] touch-manipulation"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm sm:text-base">Quay lại</span>
            </button>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">Nộp Hồ Sơ Trực Tuyến</h2>
          </div>

          <form onSubmit={handleSubmitApplication} className="space-y-4 sm:space-y-6">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Họ và tên *</label>
              <input
                type="text"
                required
                value={submissionData.fullName}
                onChange={(e) => setSubmissionData({...submissionData, fullName: e.target.value})}
                className="w-full px-3 sm:px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nhập họ và tên đầy đủ"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Số điện thoại *</label>
              <input
                type="tel"
                required
                value={submissionData.phoneNumber}
                onChange={(e) => setSubmissionData({...submissionData, phoneNumber: e.target.value})}
                className="w-full px-3 sm:px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nhập số điện thoại"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Số CCCD/CMND *</label>
              <input
                type="text"
                required
                value={submissionData.idNumber}
                onChange={(e) => setSubmissionData({...submissionData, idNumber: e.target.value})}
                className="w-full px-3 sm:px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nhập số căn cước công dân"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Loại thủ tục *</label>
              <select
                required
                value={submissionData.serviceType}
                onChange={(e) => setSubmissionData({...submissionData, serviceType: e.target.value})}
                className="w-full px-3 sm:px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Chọn loại thủ tục</option>
                <option value="withdraw_documents">Thủ tục rút hồ sơ/học bạ</option>
                <option value="academic_certificate">Thủ tục cấp giấy xác nhận kết quả học tập THPT</option>
                <option value="academic_process">Thủ tục cấp giấy xác nhận quá trình học tập</option>
                <option value="transfer_out">Thủ tục chuyển trường đi</option>
                <option value="enrollment_confirmation">Thủ tục xác nhận đang học tại trường</option>
                <option value="graduation_certificate">Thủ tục rút bằng tốt nghiệp THPT</option>
                <option value="program_completion">Thủ tục xác nhận hoàn thành chương trình THPT</option>
                <option value="temp_graduation_certificate">Thủ tục cấp lại giấy chứng nhận tốt nghiệp (tạm thời)</option>
              </select>

              {/* Mẫu đơn download và thông báo */}
              {submissionData.serviceType && (
                <div className="mt-3 space-y-3">
                  {/* Download links cho các mẫu đơn */}
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-800 mb-2">Tải mẫu đơn:</p>
                    <div className="flex flex-wrap gap-2">
                      {submissionData.serviceType === 'withdraw_documents' && (
                        <a
                          href="/forms/Rút hồ sơ_học bạ.pdf"
                          download="Rút hồ sơ_học bạ.pdf"
                          className="inline-flex items-center px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Rút hồ sơ_học bạ.pdf
                        </a>
                      )}

                      {submissionData.serviceType === 'academic_certificate' && (
                        <a
                          href="/forms/Đơn cấp lại kết quả học tập THPT.pdf"
                          download="Đơn cấp lại kết quả học tập THPT.pdf"
                          className="inline-flex items-center px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Đơn cấp lại kết quả học tập THPT.pdf
                        </a>
                      )}

                      {submissionData.serviceType === 'academic_process' && (
                        <a
                          href="/forms/Đơn xác nhận quá trình học tập.pdf"
                          download="Đơn xác nhận quá trình học tập.pdf"
                          className="inline-flex items-center px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Đơn xác nhận quá trình học tập.pdf
                        </a>
                      )}

                      {submissionData.serviceType === 'transfer_out' && (
                        <>
                          <a
                            href="/forms/Đơn chuyển trường (trong tỉnh).pdf"
                            download="Đơn chuyển trường (trong tỉnh).pdf"
                            className="inline-flex items-center px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Đơn chuyển trường (trong tỉnh).pdf
                          </a>
                          <a
                            href="/forms/Đơn chuyển trường (ngoài tỉnh).pdf"
                            download="Đơn chuyển trường (ngoài tỉnh).pdf"
                            className="inline-flex items-center px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Đơn chuyển trường (ngoài tỉnh).pdf
                          </a>
                        </>
                      )}

                      {submissionData.serviceType === 'graduation_certificate' && (
                        <a
                          href="/forms/Giấy ủy quyền.pdf"
                          download="Giấy ủy quyền.pdf"
                          className="inline-flex items-center px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Giấy ủy quyền.pdf
                        </a>
                      )}

                      {submissionData.serviceType === 'program_completion' && (
                        <a
                          href="/forms/Đơn xác nhận hoàn thành chương trình THPT.pdf"
                          download="Đơn xác nhận hoàn thành chương trình THPT.pdf"
                          className="inline-flex items-center px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Đơn xác nhận hoàn thành chương trình THPT.pdf
                        </a>
                      )}

                      {submissionData.serviceType === 'temp_graduation_certificate' && (
                        <a
                          href="/forms/Đơn cấp Giấy chứng nhận tốt nghiệp (tạm thời).pdf"
                          download="Đơn cấp Giấy chứng nhận tốt nghiệp (tạm thời).pdf"
                          className="inline-flex items-center px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Đơn cấp Giấy chứng nhận tốt nghiệp (tạm thời).pdf
                        </a>
                      )}

                      {submissionData.serviceType === 'enrollment_confirmation' && (
                        <div className="text-sm text-blue-800 bg-blue-100 p-2 rounded">
                          <strong>Lưu ý:</strong> Đối với học sinh đang học tại trường thì chỉ cần đăng ký thủ tục và cung cấp ảnh mặt trước CCCD
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Thông báo đặc biệt cho các thủ tục cần ủy quyền */}
                  {(submissionData.serviceType === 'withdraw_documents' || 
                    submissionData.serviceType === 'graduation_certificate' ||
                    submissionData.serviceType === 'temp_graduation_certificate') && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>Lưu ý:</strong> Nếu phụ huynh hoặc người thân đến nhận thay phải có giấy ủy quyền có xác nhận UBND xã/phường nơi học sinh cư trú và Căn cước công dân của người đến nhận thay.
                      </p>
                    </div>
                  )}
                </div>
              )}
>>>>
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Tải lên file scan *</label>
              <p className="text-xs sm:text-sm text-gray-500 mb-3">Hỗ trợ file ảnh JPG, JPEG, PNG (tối đa 10MB/file)</p>
              
              <div className="mb-4">
                <input
                  type="file"
                  multiple
                  required
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  accept=".jpg,.jpeg,.png"
                />
                <label htmlFor="file-upload" className="cursor-pointer inline-flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors text-sm sm:text-base min-h-[44px] w-full sm:w-auto touch-manipulation">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-center">Đính kèm ảnh (mặt trước CCCD và mẫu đơn (nếu có))</span>
                </label>
              </div>

              {submissionData.files.length > 0 && (
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-700 mb-3">Ảnh đã đính kèm ({submissionData.files.length} ảnh):</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
                    {submissionData.files.map((file, index) => {
                      const objectUrl = URL.createObjectURL(file);
                      return (
                        <div key={index} className="relative group">
                          <img
                            src={objectUrl}
                            alt={`Ảnh đính kèm ${index + 1}`}
                            className="w-full h-20 sm:h-24 object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(index)}
                            className="absolute top-1 right-1 w-7 h-7 sm:w-6 sm:h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity touch-manipulation"
                            aria-label="Xóa ảnh"
                          >
                            <svg className="w-3 h-3 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                          <div className="absolute bottom-1 left-1 right-1 bg-black bg-opacity-50 text-white text-xs p-1 rounded truncate">
                            {file.name.length > 15 ? file.name.substring(0, 12) + '...' : file.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Tổng dung lượng: {(submissionData.files.reduce((total, file) => total + file.size, 0) / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              )}
            </div>

            <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-3 px-4 sm:px-6 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-medium text-sm sm:text-base min-h-[44px] disabled:bg-blue-300 disabled:cursor-not-allowed touch-manipulation"
                  disabled={!submissionData.fullName || !submissionData.phoneNumber || !submissionData.idNumber || !submissionData.serviceType}
                >
                  Gửi Hồ Sơ
                </button>
          </form>
        </div>
      </div>
    </div>
  );

  const renderTrackForm = () => (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-8 md:py-12 px-4 sm:px-6">
      <div className="max-w-full sm:max-w-md mx-auto">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-5 sm:p-6 md:p-8">
          <div className="flex items-center mb-4 sm:mb-6">
            <button
              onClick={() => setCurrentView('home')}
              className="flex items-center text-blue-600 hover:text-blue-800 mr-3 sm:mr-4 min-h-[44px] touch-manipulation"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm sm:text-base">Quay lại</span>
            </button>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">Tra Cứu Tiến Độ Hồ Sơ</h2>
          </div>

          <form onSubmit={handleTrackApplication} className="space-y-4 sm:space-y-6">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Mã hồ sơ hoặc số CCCD/CMND *</label>
              <input
                type="text"
                required
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                className="w-full px-3 sm:px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nhập mã hồ sơ (VD: HS123456) hoặc số CCCD/CMND"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-green-600 text-white py-3 px-4 sm:px-6 rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors font-medium text-sm sm:text-base min-h-[44px] disabled:bg-green-300 disabled:cursor-not-allowed touch-manipulation"
              disabled={!trackingCode.trim()}
            >
              Tra Cứu
            </button>
          </form>

          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
                <strong>Lưu ý:</strong> Có thể tra cứu bằng mã hồ sơ hoặc số CCCD/CMND. 
                Nếu gặp vấn đề, vui lòng liên hệ bộ phận giáo vụ.
            </p>
>>>>>>>
          </div>
        </div>
      </div>
    </div>
  );

  const renderConfirmation = () => (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-8 md:py-12 px-4 sm:px-6">
      <div className="max-w-full sm:max-w-md mx-auto">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-5 sm:p-6 md:p-8 text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <svg className="w-7 h-7 sm:w-8 sm:h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">Hồ Sơ Đã Tiếp Nhận Thành Công!</h2>
          
          <div className="bg-gray-50 p-3 sm:p-4 rounded-lg mb-4 sm:mb-6">
            <p className="text-xs sm:text-sm text-gray-600 mb-2">Mã hồ sơ của bạn:</p>
            <div className="text-xl sm:text-2xl font-bold text-blue-600 bg-white py-3 px-4 sm:px-6 rounded border-2 border-dashed border-blue-200 break-all">
              {submissionResult.code}
            </div>
          </div>

          <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 px-2">
            Vui lòng lưu lại mã này để tra cứu tiến độ xử lý hồ sơ.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => setCurrentView('track-form')}
              className="w-full bg-blue-600 text-white py-3 px-4 sm:px-6 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-medium text-sm sm:text-base min-h-[44px] touch-manipulation"
            >
              Tra Cứu Tiến Độ Ngay
            </button>
            <button
              onClick={() => setCurrentView('home')}
              className="w-full border border-gray-300 text-gray-700 py-3 px-4 sm:px-6 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors text-sm sm:text-base min-h-[44px] touch-manipulation"
            >
              Về Trang Chủ
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTrackingResult = () => (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-8 md:py-12 px-4 sm:px-6">
      <div className="max-w-full sm:max-w-md mx-auto">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-5 sm:p-6 md:p-8">
          <div className="flex items-center mb-4 sm:mb-6">
            <button
              onClick={() => setCurrentView('track-form')}
              className="flex items-center text-blue-600 hover:text-blue-800 mr-3 sm:mr-4 min-h-[44px] touch-manipulation"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm sm:text-base">Quay lại</span>
            </button>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">Kết Quả Tra Cứu</h2>
          </div>

          <div className="text-center mb-4 sm:mb-6">
            <div className="text-xs sm:text-sm text-gray-600 mb-2">Mã hồ sơ</div>
            <div className="text-lg sm:text-xl font-bold text-blue-600 break-all px-2">{submissionResult.code}</div>
          </div>

          <div className={`p-6 rounded-lg mb-6 ${
            submissionResult.status === 'completed' ? 'bg-green-50 border border-green-200' :
            submissionResult.status === 'needs_more_info' ? 'bg-yellow-50 border border-yellow-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-center justify-center mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                submissionResult.status === 'completed' ? 'bg-green-100' :
                submissionResult.status === 'needs_more_info' ? 'bg-yellow-100' :
                'bg-blue-100'
              }`}>
                <svg className={`w-6 h-6 ${
                  submissionResult.status === 'completed' ? 'text-green-600' :
                  submissionResult.status === 'needs_more_info' ? 'text-yellow-600' :
                  'text-blue-600'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {submissionResult.status === 'completed' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  ) : submissionResult.status === 'needs_more_info' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  )}
                </svg>
              </div>
            </div>
            <p className={`text-center font-medium ${
              submissionResult.status === 'completed' ? 'text-green-800' :
              submissionResult.status === 'needs_more_info' ? 'text-yellow-800' :
              'text-blue-800'
            }`}>
              {submissionResult.status === 'completed' ? 'Hoàn Thành' :
               submissionResult.status === 'needs_more_info' ? 'Cần Bổ Sung' :
               'Đang Xử Lý'}
            </p>
            <p className="text-center text-gray-600 mt-2">
              {submissionResult.message}
            </p>

            {/* Thời gian nhận kết quả */}
            {submissionResult.status === 'completed' && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-green-200">
                <h5 className="font-semibold text-green-800 mb-2">Thông tin nhận kết quả:</h5>
                <div className="text-sm text-green-700 space-y-1">
                  <p><strong>Thời gian:</strong> Thứ 2 - Thứ 6: Buổi sáng: 8:00 - 10:30, Buổi chiều: 14:00 - 16:30</p>
                  <p><strong>Địa điểm:</strong> Bộ phận Giáo vụ của trường</p>
                  <p><strong>Mang theo:</strong> CCCD, mẫu đơn (nếu có)</p>
                </div>
>>>>>>>
              </div>
            )}

            {/* Thời gian xử lý dự kiến */}
            {submissionResult.status !== 'completed' && submissionResult.status !== 'needs_more_info' && (
              <div className="mt-4 p-4 bg-white rounded-lg border border-blue-200">
                <h5 className="font-semibold text-blue-800 mb-2">Thời gian xử lý dự kiến:</h5>
                <div className="text-sm text-blue-700">
                  <p>{submissionResult.status === 'pending' 
                    ? 'Dự kiến bắt đầu xử lý trong vòng 01 buổi' 
                    : 'Dự kiến hoàn thành trong 01 buổi làm việc'}</p>
                </div>
              </div>
            )}

            </div>

          <div className="space-y-3">
            {submissionResult.status === 'needs_more_info' && (
              <button
                onClick={handleUpdateApplication}
                className="w-full bg-yellow-600 text-white py-3 px-4 sm:px-6 rounded-lg hover:bg-yellow-700 active:bg-yellow-800 transition-colors font-medium text-sm sm:text-base min-h-[44px] touch-manipulation"
              >
                Bổ Sung Hồ Sơ
              </button>
            )}
            <button
              onClick={() => setCurrentView('home')}
              className="w-full bg-blue-600 text-white py-3 px-4 sm:px-6 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors font-medium text-sm sm:text-base min-h-[44px] touch-manipulation"
            >
              Về Trang Chủ
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAdminLogin = () => (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-8 md:py-12 px-4 sm:px-6">
      <div className="max-w-full sm:max-w-md mx-auto">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-5 sm:p-6 md:p-8">
          <div className="flex items-center mb-4 sm:mb-6">
            <button
              onClick={() => setCurrentView('home')}
              className="flex items-center text-blue-600 hover:text-blue-800 mr-3 sm:mr-4 min-h-[44px] touch-manipulation"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm sm:text-base">Quay lại</span>
            </button>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">Đăng Nhập Admin</h2>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4 sm:space-y-6">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Mật khẩu admin *</label>
              <input
                type="password"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full px-3 sm:px-4 py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Nhập mật khẩu admin"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-purple-600 text-white py-3 px-4 sm:px-6 rounded-lg hover:bg-purple-700 active:bg-purple-800 transition-colors font-medium text-sm sm:text-base min-h-[44px] touch-manipulation"
            >
              Đăng Nhập
            </button>
          </form>

        </div>
      </div>
    </div>
  );

  const renderAdminDashboard = () => (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-8 md:py-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 md:p-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
            <div className="flex items-center flex-wrap gap-2">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">Bảng Điều Khiển Admin</h2>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs sm:text-sm font-medium">
                {applications.length} hồ sơ
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <button
                onClick={exportToExcel}
                className="flex items-center justify-center px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors text-sm sm:text-base min-h-[44px] touch-manipulation"
                disabled={applications.length === 0}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">Xuất Excel</span>
                <span className="sm:hidden">Excel</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center px-3 sm:px-4 py-2 text-red-600 hover:bg-red-50 active:bg-red-100 rounded-lg transition-colors text-sm sm:text-base min-h-[44px] border border-red-200 touch-manipulation"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Đăng Xuất
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="mb-4 sm:mb-6">
            <div className="w-full sm:max-w-md">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Tìm kiếm theo số CCCD/CMND</label>
              <input
                type="text"
                value={searchCCCD}
                onChange={(e) => setSearchCCCD(e.target.value)}
                className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Nhập số CCCD/CMND để tìm kiếm"
              />
              {searchCCCD.trim() && (
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  Tìm thấy {filteredApplications.length} kết quả
                </p>
              )}
            </div>
          </div>

          {applications.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500 text-lg">Chưa có hồ sơ nào được nộp</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">STT</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mã Hồ Sơ</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Họ Tên</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Số CCCD</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Số ĐT</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Loại Thủ Tục</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng Thái</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Đã Nhận</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thời Gian</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thao Tác & Ảnh</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredApplications.map((app, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {app.orderNumber || index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        {app.code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {app.fullName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {app.idNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {app.phoneNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {app.serviceType === 'withdraw_documents' ? 'Thủ tục rút hồ sơ/học bạ' :
                         app.serviceType === 'academic_certificate' ? 'Thủ tục cấp giấy xác nhận kết quả học tập THPT' :
      app.serviceType === 'academic_process' ? 'Thủ tục cấp giấy xác nhận quá trình học tập' :
                         app.serviceType === 'transfer_out' ? 'Thủ tục chuyển trường đi' :
                         app.serviceType === 'enrollment_confirmation' ? 'Thủ tục xác nhận đang học tại trường' :
                         app.serviceType === 'graduation_certificate' ? 'Thủ tục rút bằng tốt nghiệp THPT' :
                         app.serviceType === 'program_completion' ? 'Thủ tục xác nhận hoàn thành chương trình THPT' :
                         app.serviceType === 'temp_graduation_certificate' ? 'Thủ tục cấp lại giấy chứng nhận tốt nghiệp (tạm thời)' : 'Thủ tục khác'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          app.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          app.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                          app.status === 'needs_more_info' ? 'bg-orange-100 text-orange-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {app.status === 'pending' ? 'Chờ xử lý' :
                           app.status === 'processing' ? 'Đang xử lý' :
                           app.status === 'needs_more_info' ? 'Cần bổ sung' :
                           'Hoàn thành'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <input
                          type="checkbox"
                          checked={app.isReceived || false}
                          onChange={() => handleToggleReceived(app.code)}
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        />
                        {app.receivedAt && (
                          <div className="text-xs text-green-600 mt-1">
                            {new Date(app.receivedAt).toLocaleString('vi-VN')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div>Nộp: {new Date(app.submittedAt).toLocaleString('vi-VN')}</div>
                        {app.completedAt && (
                          <div className="text-xs text-green-600 mt-1">
                            Hoàn thành: {new Date(app.completedAt).toLocaleString('vi-VN')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-y-2">
                        {showNoteInput === app.code ? (
                          <div className="space-y-2">
                            <textarea
                              value={adminNote}
                              onChange={(e) => setAdminNote(e.target.value)}
                              placeholder="Nhập thông tin cần bổ sung (VD: Cần bổ sung bản sao CCCD có công chứng)"
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm resize-none"
                              rows={3}
                            />
                            <div className="flex space-x-1">
                              <button
                                onClick={() => handleSaveAdminNote(app.code)}
                                className="flex-1 bg-yellow-600 text-white px-2 py-1 rounded text-xs hover:bg-yellow-700"
                              >
                                Lưu
                              </button>
                              <button
                                onClick={handleCancelNote}
                                className="flex-1 bg-gray-500 text-white px-2 py-1 rounded text-xs hover:bg-gray-600"
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <select
                              value={app.status}
                              onChange={(e) => handleStatusUpdate(app.code, e.target.value)}
                              className="w-full px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            >
                              <option value="pending">Chờ xử lý</option>
                              <option value="processing">Đang xử lý</option>
                              <option value="needs_more_info">Cần bổ sung</option>
                              <option value="completed">Hoàn thành</option>
                            </select>
                            {app.adminNote && (
                              <div className="text-xs text-orange-600 p-1 bg-orange-50 rounded">
                                Ghi chú: {app.adminNote}
                              </div>
                            )}
                          </>
                        )}
                        {app.files && app.files.length > 0 && (
                          <button
                            onClick={() => setSelectedApplication(app)}
                            className="w-full bg-blue-50 text-blue-600 px-3 py-1 rounded-md text-sm hover:bg-blue-100 transition-colors"
                          >
                            Xem ảnh ({app.files.length})
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {(() => {
        switch (currentView) {
          case 'submit-form':
            return renderSubmitForm();
          case 'track-form':
            return renderTrackForm();
          case 'confirmation':
            return renderConfirmation();
          case 'tracking-result':
            return renderTrackingResult();
          case 'admin-login':
            return renderAdminLogin();
          case 'admin-dashboard':
            return isAdminAuthenticated ? renderAdminDashboard() : renderAdminLogin();
          default:
            return renderHomeView();
        }
      })()}

      {/* Modal xem ảnh - Available globally */}
      {selectedApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl max-w-full sm:max-w-4xl w-full max-h-screen overflow-y-auto">
            <div className="sticky top-0 bg-white p-4 sm:p-6 border-b flex items-center justify-between">
              <div className="flex-1 min-w-0 mr-3">
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 truncate">
                  Ảnh đính kèm - {selectedApplication.code}
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-1 truncate">
                  {selectedApplication.fullName} • {selectedApplication.files.length} ảnh
                </p>
              </div>
              <button
                onClick={() => setSelectedApplication(null)}
                className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-full flex items-center justify-center transition-colors flex-shrink-0 touch-manipulation"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {selectedApplication.files.map((file: any, index: number) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-3">
                    <div 
                      className="aspect-video bg-gray-200 rounded-lg mb-3 overflow-hidden cursor-pointer hover:opacity-75 transition-opacity"
                      onClick={() => file.data && setSelectedImage(file.data)}
                    >
                      {file.data ? (
                        <img
                          src={file.data}
                          alt={`Ảnh đính kèm ${index + 1} - ${file.name}`}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-gray-900 truncate">{file.name}</p>
                      <p className="text-gray-500 mt-1">
                        {file.type} • {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              
              <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-blue-50 rounded-lg">
                <p className="text-xs sm:text-sm text-blue-800">
                  <strong>Hướng dẫn:</strong> Click vào ảnh để xem kích thước lớn hơn. 
                  Tất cả ảnh được lưu trữ an toàn trong hệ thống.
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="relative w-full h-full sm:max-w-4xl sm:max-h-full flex items-center justify-center">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-2 right-2 sm:top-4 sm:right-4 w-10 h-10 sm:w-12 sm:h-12 bg-white bg-opacity-80 hover:bg-opacity-100 active:bg-opacity-100 rounded-full flex items-center justify-center transition-colors z-10 touch-manipulation"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={selectedImage}
              alt="Ảnh phóng to"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicServicePortal;
