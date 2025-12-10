import React, { useState, useEffect, useRef } from 'react';
import { Mic, Send, Bot, Loader2, StopCircle, X } from 'lucide-react';
import { ChatMessage } from '../types';

interface AssistantProps {
  isProcessing: boolean;
  onSendMessage: (text: string) => void;
  messages: ChatMessage[];
  onClose?: () => void;
}

export const Assistant: React.FC<AssistantProps> = ({ isProcessing, onSendMessage, messages, onClose }) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      // Set language to Chinese
      recognitionRef.current.lang = 'zh-CN';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        handleSend(transcript); // Auto-send on voice end
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    onSendMessage(text);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full bg-white md:border-l border-gray-200 shadow-xl w-full">
      <div className="p-4 bg-indigo-600 text-white flex items-center justify-between shadow-sm flex-none">
        <div className="flex items-center gap-2">
          <Bot className="w-6 h-6" />
          <h2 className="font-semibold text-lg">AI 助手</h2>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-white/80 hover:text-white p-1">
            <X className="w-6 h-6" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-10">
            <p className="mb-2">👋 你好! 我是你的智能日程助手。</p>
            <p className="text-sm">试着说: <br/>"明天下午两点和团队开会"</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none'
                  : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none shadow-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-white p-3 rounded-2xl rounded-bl-none border border-gray-200 shadow-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span className="text-sm text-gray-500">思考中...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-gray-200 flex-none pb-safe">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleListening}
            className={`p-3 rounded-full transition-colors flex-shrink-0 ${
              isListening
                ? 'bg-red-100 text-red-600 animate-pulse'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title="语音输入 (中文)"
          >
            {isListening ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
              placeholder="输入..."
              className="w-full pl-4 pr-10 py-3 bg-gray-100 border-none rounded-full text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              disabled={isProcessing || isListening}
            />
          </div>
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isProcessing}
            className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};