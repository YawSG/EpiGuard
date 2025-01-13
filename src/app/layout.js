const ChatView = () => {
    const chatContainerRef = useRef(null);
    const inputRef = useRef(null);  // Add this line

    useEffect(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }, [chatHistory]);

    const handleInputChange = (e) => {
      setInputText(e.target.value);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    };

    return (
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-800">
        <div
          ref={chatContainerRef}
          className="flex-1 p-4 overflow-y-auto"
        >
          <div className="space-y-4">
            {chatHistory.map((message) => (
              <div
                key={message.id}
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.sender === 'bot'
                    ? 'bg-white dark:bg-gray-700 shadow-sm ml-0 dark:text-white'
                    : 'bg-green-500 text-white ml-auto'
                }`}
              >
                {message.text}
              </div>
            ))}
            {isProcessing && (
              <div className="bg-white dark:bg-gray-700 shadow-sm ml-0 max-w-[80%] p-3 rounded-lg dark:text-white">
                <span className="animate-pulse">...</span>
              </div>
            )}
          </div>
        </div>
        <div className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center space-x-2">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-1 p-2 border dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              style={{ fontSize: '16px' }}
            />
            <button
              onClick={handleVoiceChat}
              className={`p-2 ${isRecording ? 'bg-red-500' : 'bg-gray-200 dark:bg-gray-700'} text-gray-700 dark:text-white rounded-md hover:bg-opacity-90`}
            >
              <Mic size={20} />
            </button>
            <button
              onClick={() => handleSendMessage()}
              className="p-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              disabled={isProcessing}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  };
