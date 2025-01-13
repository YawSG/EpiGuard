"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, Home, MessageCircle, Shield, Mic, Send, Activity, Calendar, Bell, Clock } from 'lucide-react';

const EpiGuard = () => {
  // Global state
  const [view, setView] = useState('welcome');
  const [chatHistory, setChatHistory] = useState([
    { id: '1', text: "Hi, how are you feeling today?", sender: "bot" }
  ]);
  const [symptoms, setSymptoms] = useState([]);
  const [nextLogDue, setNextLogDue] = useState(null);
  const [riskLevel, setRiskLevel] = useState('Low');
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recognition, setRecognition] = useState(null);
  const [isSupported, setIsSupported] = useState(true);

  // Settings state with enhanced default dark mode detection
  const [settings, setSettings] = useState({
    notifications: true,
    reminderInterval: 12,
    theme: 'system',
    language: 'en',
    emergencyContacts: [
      { name: 'Dr. Smith', number: '555-0123', type: 'Medical' }
    ]
  });


  // Initialize symptom logging timer with proper interval
  useEffect(() => {
    // Set initial next log due time if not set
    if (!nextLogDue) {
      const now = new Date();
      setNextLogDue(new Date(now.getTime() + (settings.reminderInterval * 60 * 60 * 1000)));
    }

    const checkAndUpdateTimer = () => {
      const currentTime = new Date();
      if (nextLogDue && currentTime >= nextLogDue) {
        // Update next due time
        const newDueTime = new Date(currentTime.getTime() + (settings.reminderInterval * 60 * 60 * 1000));
        setNextLogDue(newDueTime);

        // Show notification if enabled
        if (settings.notifications && Notification.permission === "granted") {
          new Notification("EpiGuard Reminder", {
            body: "It's time to log your symptoms. How are you feeling now?"
          });
        }

        // Add reminder message to chat
        setChatHistory(prev => [...prev, {
          id: Date.now().toString(),
          text: "It's time to log your symptoms. How are you feeling now?",
          sender: "bot"
        }]);
      }
    };

    const interval = setInterval(checkAndUpdateTimer, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [settings.reminderInterval, settings.notifications, nextLogDue]);

  // Enhanced theme effect with system preference detection
  useEffect(() => {
    const root = document.documentElement;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    const updateTheme = () => {
      if (settings.theme === 'dark' || (settings.theme === 'system' && systemPrefersDark)) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    updateTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (settings.theme === 'system') {
        updateTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [settings.theme]);

  // Enhanced translation function with error handling
  const translateMessage = async (text, targetLang) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Translate the following text to ${targetLang}: ${text}`,
          history: [],
          isTranslation: true
        })
      });

      if (!response.ok) throw new Error('Translation failed');
      const data = await response.json();
      return data.message || text;
    } catch (error) {
      console.error('Translation error:', error);
      return text; // Fallback to original text
    }
  };

  // Translation effect for UI elements
  useEffect(() => {
    const translateUI = async () => {
      if (settings.language === 'en') return;

      try {
        // Translate chat history
        const updatedHistory = await Promise.all(
          chatHistory.map(async (msg) => ({
            ...msg,
            text: await translateMessage(msg.text, settings.language)
          }))
        );
        setChatHistory(updatedHistory);

        // Translate symptoms
        const updatedSymptoms = await Promise.all(
          symptoms.map(async (symptom) => ({
            ...symptom,
            symptom: await translateMessage(symptom.symptom, settings.language),
            advice: await translateMessage(symptom.advice, settings.language)
          }))
        );
        setSymptoms(updatedSymptoms);
      } catch (error) {
        console.error('Translation error:', error);
      }
    };

    translateUI();
  }, [settings.language]);

  // Settings persistence
  useEffect(() => {
    const savedSettings = localStorage.getItem('epiguardSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Failed to parse saved settings:', error);
      }
    }
  }, []);

  const updateSettings = (newSettings) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('epiguardSettings', JSON.stringify(updated));
      return updated;
    });
  };

  // Speech recognition initialization
useEffect(() => {
  if (typeof window !== 'undefined') {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      // Map language codes to their BCP 47 language tags
      const languageMap = {
        'en': 'en-US',
        'es': 'es-ES',
        'fr': 'fr-FR'
      };

      recognition.lang = languageMap[settings.language] || 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setTranscript(transcript);
        handleSendMessage(transcript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);

        if (event.error === 'language-not-supported') {
          // Update state to show language not supported
          setIsSupported(false);
          // Show a more user-friendly message
          const currentLang = settings.language.toUpperCase();
          alert(`Speech recognition is currently not available for ${currentLang}. You can change the language in settings or type your message instead.`);
        }
      };

      recognition.onend = () => setIsRecording(false);
      setRecognition(recognition);
    } else {
      setIsSupported(false);
    }
  }
}, [settings.language]);

  // Enhanced message processing
  const processMessageWithAI = async (userMessage) => {
    try {
      let processedMessage = userMessage;
      if (settings.language !== 'en') {
        processedMessage = await translateMessage(userMessage, 'en');
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: processedMessage,
          history: chatHistory.slice(-6).map(msg => ({
            role: msg.sender === 'bot' ? 'assistant' : 'user',
            content: msg.text
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Translate response if needed
      if (settings.language !== 'en') {
        data.message = await translateMessage(data.message, settings.language);
        if (data.symptoms) {
          data.symptoms = await Promise.all(
            data.symptoms.map(async (symptom) => ({
              ...symptom,
              symptom: await translateMessage(symptom.symptom, settings.language)
            }))
          );
        }
      }

      // Process symptom actions
      if (data.symptomActions) {
        setSymptoms(prevSymptoms => {
          let updatedSymptoms = [...prevSymptoms];

          // Remove symptoms
          if (data.symptomActions.remove?.length > 0) {
            updatedSymptoms = updatedSymptoms.filter(symptom =>
              !data.symptomActions.remove.includes(symptom.symptom.toLowerCase())
            );
          }

          // Update symptoms
          if (data.symptomActions.update?.length > 0) {
            data.symptomActions.update.forEach(update => {
              const index = updatedSymptoms.findIndex(s =>
                s.symptom.toLowerCase() === update.symptom.toLowerCase()
              );
              if (index !== -1) {
                updatedSymptoms[index] = {
                  ...updatedSymptoms[index],
                  ...update,
                  timestamp: new Date(),
                  advice: getAdviceForSymptom(update.severity || updatedSymptoms[index].severity)
                };
              }
            });
          }

          // Add new symptoms
          const newSymptoms = data.symptoms?.map(symptom => ({
            ...symptom,
            timestamp: new Date(),
            advice: getAdviceForSymptom(symptom.severity)
          })) || [];

          // Filter recent symptoms
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const recentSymptoms = updatedSymptoms
            .filter(s => new Date(s.timestamp) > twentyFourHoursAgo)
            .filter(s => !newSymptoms.some(ns => ns.symptom.toLowerCase() === s.symptom.toLowerCase()));

          return [...recentSymptoms, ...newSymptoms];
        });

        // Update risk level
        if (data.riskLevel) {
          setRiskLevel(data.riskLevel);
        }
      }

      return data.message;
    } catch (error) {
      console.error('API Error:', error);
      return "I apologize, but I'm having trouble responding right now. Please try again in a moment.";
    }
  };

  const getAdviceForSymptom = (severity) => {
    const adviceMap = {
      'Severe': 'Seek immediate medical attention. Contact emergency services if needed.',
      'Moderate': 'Contact your healthcare provider for guidance. Monitor symptoms closely.',
      'Mild': 'Rest and monitor your symptoms. Follow your regular treatment plan.'
    };
    return adviceMap[severity] || 'Monitor your symptoms and consult your healthcare provider if they worsen.';
  };

  const handleVoiceChat = useCallback(() => {
    if (!recognition || !isSupported) {
      alert("Sorry, your browser doesn't support speech recognition.");
      return;
    }

    if (isRecording) {
      recognition.stop();
    } else {
      setTranscript('');
      recognition.start();
      setIsRecording(true);
    }
  }, [recognition, isRecording, isSupported]);


 const handleSendMessage = async (messageText = '') => {
    const textToSend = String(messageText).trim();
    if (!textToSend || isProcessing) return;

    setIsProcessing(true);

    const newMessage = {
      id: Date.now().toString(),
      text: textToSend,
      sender: "user"
    };

    setChatHistory(prev => [...prev, newMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: textToSend,
          history: chatHistory.slice(-6).map(msg => ({
            role: msg.sender === 'bot' ? 'assistant' : 'user',
            content: msg.text
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      setChatHistory(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: data.message,
        sender: "bot"
      }]);

      // Process symptom actions
      if (data.symptomActions) {
        setSymptoms(prevSymptoms => {
          let updatedSymptoms = [...prevSymptoms];

          // Remove symptoms
          if (data.symptomActions.remove?.length > 0) {
            updatedSymptoms = updatedSymptoms.filter(symptom =>
              !data.symptomActions.remove.includes(symptom.symptom.toLowerCase())
            );
          }

          // Update symptoms
          if (data.symptomActions.update?.length > 0) {
            data.symptomActions.update.forEach(update => {
              const index = updatedSymptoms.findIndex(s =>
                s.symptom.toLowerCase() === update.symptom.toLowerCase()
              );
              if (index !== -1) {
                updatedSymptoms[index] = {
                  ...updatedSymptoms[index],
                  ...update,
                  timestamp: new Date(),
                  advice: getAdviceForSymptom(update.severity || updatedSymptoms[index].severity)
                };
              }
            });
          }

          // Add new symptoms
          const newSymptoms = data.symptoms?.map(symptom => ({
            ...symptom,
            timestamp: new Date(),
            advice: getAdviceForSymptom(symptom.severity)
          })) || [];

          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const recentSymptoms = updatedSymptoms
            .filter(s => new Date(s.timestamp) > twentyFourHoursAgo)
            .filter(s => !newSymptoms.some(ns => ns.symptom.toLowerCase() === s.symptom.toLowerCase()));

          return [...recentSymptoms, ...newSymptoms];
        });

        // Update risk level
        if (data.riskLevel) {
          setRiskLevel(data.riskLevel);
        }
      }
    } catch (error) {
      console.error('Chat Error:', error);
      setChatHistory(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, but I'm having trouble responding right now. Please try again in a moment.",
        sender: "bot"
      }]);
    }

    setIsProcessing(false);
  };


  const SettingsView = () => {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-8">
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">Settings</h2>

          {/* Notifications */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Notifications</h3>
            <div className="flex items-center justify-between">
              <span>Enable Notifications</span>
              <button
                onClick={() => {
                  if (!settings.notifications) {
                    Notification.requestPermission().then(permission => {
                      if (permission === "granted") {
                        updateSettings({ notifications: true });
                      }
                    });
                  } else {
                    updateSettings({ notifications: false });
                  }
                }}
                className={`w-12 h-6 rounded-full relative transition-colors duration-200 ease-in-out ${
                  settings.notifications ? 'bg-green-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`absolute w-5 h-5 bg-white rounded-full transition-transform duration-200 ease-in-out transform ${
                    settings.notifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block">Reminder Interval (hours)</label>
              <select
                value={settings.reminderInterval}
                onChange={(e) => updateSettings({ reminderInterval: Number(e.target.value) })}
                className="w-full p-2 border rounded-md"
              >
                <option value={4}>Every 4 hours</option>
                <option value={8}>Every 8 hours</option>
                <option value={12}>Every 12 hours</option>
                <option value={24}>Every 24 hours</option>
              </select>
            </div>
          </div>

          {/* Appearance */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Appearance</h3>
            <DarkModeToggle />
          </div>

          {/* Language */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Language</h3>
            <select
              value={settings.language}
              onChange={(e) => updateSettings({ language: e.target.value })}
              className="w-full p-2 border rounded-md"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
            </select>
          </div>

          {/* Emergency Contacts */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Emergency Contacts</h3>
            <div className="space-y-4">
              {settings.emergencyContacts.map((contact, index) => (
                <div key={index} className="p-4 border rounded-md space-y-2">
                  <div className="flex justify-between">
                    <input
                      type="text"
                      value={contact.name}
                      onChange={(e) => {
                        const newContacts = [...settings.emergencyContacts];
                        newContacts[index] = { ...contact, name: e.target.value };
                        updateSettings({ emergencyContacts: newContacts });
                      }}
                      placeholder="Contact Name"
                      className="w-full p-2 border rounded-md mr-2"
                    />
                    <button
                      onClick={() => {
                        const newContacts = settings.emergencyContacts.filter((_, i) => i !== index);
                        updateSettings({ emergencyContacts: newContacts });
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </div>
                  <input
                    type="tel"
                    value={contact.number}
                    onChange={(e) => {
                      const newContacts = [...settings.emergencyContacts];
                      newContacts[index] = { ...contact, number: e.target.value };
                      updateSettings({ emergencyContacts: newContacts });
                    }}
                    placeholder="Phone Number"
                    className="w-full p-2 border rounded-md"
                  />
                  <select
                    value={contact.type}
                    onChange={(e) => {
                      const newContacts = [...settings.emergencyContacts];
                      newContacts[index] = { ...contact, type: e.target.value };
                      updateSettings({ emergencyContacts: newContacts });
                    }}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="Medical">Medical</option>
                    <option value="Personal">Personal</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>
              ))}
              <button
                onClick={() => {
                  const newContacts = [...settings.emergencyContacts, { name: '', number: '', type: 'Personal' }];
                  updateSettings({ emergencyContacts: newContacts });
                }}
                className="w-full p-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                Add Emergency Contact
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };


const DarkModeToggle = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check initial theme on mount
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDark;
    setIsDark(newMode);

    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm">Light</span>
      <button
        onClick={toggleDarkMode}
        className="relative inline-flex items-center h-6 rounded-full w-11 bg-gray-200 dark:bg-gray-700 focus:outline-none"
      >
        <span
          className={`inline-block w-4 h-4 transform transition-transform bg-white rounded-full ${
            isDark ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <span className="text-sm">Dark</span>
    </div>
  );
};


  // Update ChatView to use proper message handling
  const ChatView = () => {
    const [quickMessage, setQuickMessage] = useState('');
    const messagesEndRef = useRef(null);

    const handleQuickChat = () => {
      if (!quickMessage.trim()) return;
      handleSendMessage(quickMessage);
      setQuickMessage('');
      setView('chat');
    };

    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
      scrollToBottom();
    }, [chatHistory]);

    return (
      <div className="flex flex-col h-screen">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatHistory.map((message) => (
            <div
              key={message.id}
              className={`max-w-[80%] p-3 rounded-lg ${
                message.sender === 'bot'
                  ? 'bg-white dark:bg-gray-700 ml-0 dark:text-white'
                  : 'bg-green-500 text-white ml-auto'
              }`}
            >
              {message.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="border-t dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={quickMessage}
              onChange={(e) => setQuickMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickChat()}
              placeholder="How are you feeling?"
              className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
             />
            <button
              onClick={handleVoiceChat}
              className={`p-2 rounded-lg ${
                isRecording ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white'
              }`}
            >
              <Mic size={20} />
            </button>
            <button
              onClick={handleSendMessage}
              disabled={isProcessing}
              className="p-2 bg-green-500 text-white rounded-lg disabled:opacity-50"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  };
  const WelcomeView = () => (
    <div className="p-8 max-w-md mx-auto space-y-6">
      <h1 className="text-2xl mb-8">
        Welcome to <span className="text-green-500">EpiGuard</span>
      </h1>
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Full Name"
          className="w-full p-2 border rounded-md"
        />
        <input
          type="text"
          placeholder="What should I call you?"
          className="w-full p-2 border rounded-md"
        />
        <input
          type="text"
          placeholder="DD/MM/YYYY"
          className="w-full p-2 border rounded-md"
        />
        <button
          onClick={() => setView('medical')}
          className="mt-4 px-6 py-2 border rounded-md flex items-center"
        >
          <span className="mr-2">Next</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );

  const MedicalView = () => (
    <div className="p-8 max-w-md mx-auto space-y-6">
      <h1 className="text-2xl">
        <span className="text-green-500">EpiGuard</span>
      </h1>
      <p className="text-lg mb-6">
        Help us help you<br />
        Connect to your GP/Medical centre<br />
        to log your details
      </p>
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Medical centre"
          className="w-full p-2 border rounded-md"
        />
        <button className="text-green-500 underline">
          Don't have one?
        </button>
        <div className="flex justify-between mt-4">
          <button
            onClick={() => setView('welcome')}
            className="px-6 py-2 border rounded-md"
          >
            ←
          </button>
          <button
            onClick={() => setView('dashboard')}
            className="px-6 py-2 border rounded-md"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );

  const ContactsView = () => (
    <div className="p-4">
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl">
            <span className="text-green-500">EpiGuard</span>
          </h2>
          <Shield className="text-green-500" />
        </div>
        <div className="space-y-4">
          <div>
            <p className="font-medium">Medical Centre:</p>
            <p className="text-lg">0778645926</p>
          </div>
          <div>
            <p className="font-medium">Carer John Wilson:</p>
            <p className="text-lg">0776927483</p>
          </div>
          <p className="text-green-500 mt-4">Open on WhatsApp</p>
        </div>
      </div>
    </div>
  );

  const DashboardView = () => {
    const [quickMessage, setQuickMessage] = useState('');
    const formatTimeRemaining = () => {
      if (!nextLogDue) return '';
      const now = new Date();
      const diff = nextLogDue - now;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m`;
    };

    const calculateProgressPercentage = () => {
      if (!nextLogDue) return 0;
      const now = new Date();
      const diff = nextLogDue - now;
      const totalDuration = settings.reminderInterval * 60 * 60 * 1000; // Convert hours to milliseconds
      const elapsed = totalDuration - diff;
      const progress = (elapsed / totalDuration) * 100;
      return Math.min(Math.max(progress, 0), 100); // Ensure between 0 and 100
    };

    const getRiskLevelColor = (level) => {
      switch (level) {
        case 'High':
          return 'text-red-500 bg-red-50 dark:bg-red-900/20';
        case 'Moderate':
          return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
        case 'Low':
          return 'text-green-500 bg-green-50 dark:bg-green-900/20';
        default:
          return 'text-gray-500 dark:text-gray-400';
      }
    };

    const handleQuickChat = () => {
      if (!quickMessage.trim()) return;
      handleSendMessage(quickMessage);
      setQuickMessage('');
      setView('chat');
    };

    return (
      <div className="p-4 space-y-4 dark:bg-gray-900">
        <div className="grid grid-cols-2 gap-4">
          {/* Symptom Logging Timer */}
          <div className="col-span-2 bg-white dark:bg-gray-800 p-6 border dark:border-gray-700 rounded-md shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium dark:text-white">Symptom Log</h3>
              <Clock className="text-green-500" />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-300">Next log due in: {formatTimeRemaining()}</p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${calculateProgressPercentage()}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Chat */}
          <div className="bg-white dark:bg-gray-800 p-6 border dark:border-gray-700 rounded-md shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium dark:text-white">Quick Chat</h3>
              <MessageCircle className="text-green-500" />
            </div>
            <div className="space-y-2">
              <input
                type="text"
                value={quickMessage}
                onChange={(e) => setQuickMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickChat()}
                placeholder="How are you feeling?"
                className="w-full p-2 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
              />
              <button
                onClick={handleQuickChat}
                className="w-full mt-2 p-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                Send
              </button>
            </div>
          </div>

          {/* Risk Assessment */}
          <div className="bg-white dark:bg-gray-800 p-6 border dark:border-gray-700 rounded-md shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium dark:text-white">Risk Assessment</h3>
              <Shield className="text-green-500" />
            </div>
            <div className="space-y-2">
              <div className={`p-3 rounded-md ${getRiskLevelColor(riskLevel)}`}>
                <p className="font-medium">Current Risk Level: {riskLevel}</p>
                {riskLevel !== 'Low' && (
                  <div className="mt-2 text-sm">
                    {riskLevel === 'High' ? (
                      <p className="text-red-700 dark:text-red-400">Please seek immediate medical attention. Stay away from other people</p>
                    ) : (
                      <p className="text-yellow-700 dark:text-yellow-400">Monitor symptoms closely and contact your healthcare provider. Stay at home so as not to spread any ilnesses</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Symptom Summary */}
          <div className="col-span-2 bg-white dark:bg-gray-800 p-6 border dark:border-gray-700 rounded-md shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium dark:text-white">Current Symptoms</h3>
              <Activity className="text-green-500" />
            </div>
            <div className="space-y-4">
              {symptoms.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">No symptoms logged yet</p>
              ) : (
                symptoms.map((symptom, index) => (
                  <div key={index} className="border-b dark:border-gray-700 pb-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium dark:text-white">{symptom.symptom}</span>
                      <span className={`text-sm ${
                        symptom.severity === 'Severe' ? 'text-red-500' :
                        symptom.severity === 'Moderate' ? 'text-yellow-500' :
                        'text-green-500'
                      }`}>
                        {symptom.severity}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{symptom.advice}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const views = {
    welcome: <WelcomeView />,
    medical: <MedicalView />,
    chat: <ChatView />,
    contacts: <ContactsView />,
    dashboard: <DashboardView />,
    settings: <SettingsView />
  };

  const showSidebar = !['welcome', 'medical'].includes(view);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Desktop Sidebar Navigation */}
      {showSidebar && (
        <nav className="hidden lg:flex flex-col w-64 border-r dark:border-gray-800 bg-white dark:bg-gray-800 min-h-screen p-4">
          <h1 className="text-2xl font-light flex items-center mb-8 dark:text-white">
            Epi<span className="text-green-500 font-normal">Guard</span>
          </h1>
          <div className="space-y-4">
            <button
              onClick={() => setView('dashboard')}
              className={`flex items-center space-x-2 w-full p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700
                ${view === 'dashboard' ? 'text-green-500' : 'dark:text-white'}`}
            >
              <Home size={20} />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setView('chat')}
              className={`flex items-center space-x-2 w-full p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700
                ${view === 'chat' ? 'text-green-500' : 'dark:text-white'}`}
            >
              <MessageCircle size={20} />
              <span>Chat</span>
            </button>
            <button
              onClick={() => setView('contacts')}
              className={`flex items-center space-x-2 w-full p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700
                ${view === 'contacts' ? 'text-green-500' : 'dark:text-white'}`}
            >
              <Shield size={20} />
              <span>Contacts</span>
            </button>
            <button
              onClick={() => setView('settings')}
              className={`flex items-center space-x-2 w-full p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700
                ${view === 'settings' ? 'text-green-500' : 'dark:text-white'}`}
            >
              <Settings size={20} />
              <span>Settings</span>
            </button>
          </div>
        </nav>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {views[view]}
        </div>

        {/* Mobile Navigation */}
        {showSidebar && (
          <nav className="lg:hidden fixed bottom-0 w-full border-t dark:border-gray-800 bg-white dark:bg-gray-800 p-4">
            <div className="flex justify-around">
              <button onClick={() => setView('dashboard')}><Home className={view === 'dashboard' ? 'text-green-500' : 'text-gray-600 dark:text-gray-300'} /></button>
              <button onClick={() => setView('chat')}><MessageCircle className={view === 'chat' ? 'text-green-500' : 'text-gray-600 dark:text-gray-300'} /></button>
              <button onClick={() => setView('contacts')}><Shield className={view === 'contacts' ? 'text-green-500' : 'text-gray-600 dark:text-gray-300'} /></button>
              <button onClick={() => setView('settings')}><Settings className={view === 'settings' ? 'text-green-500' : 'text-gray-600 dark:text-gray-300'} /></button>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
};

export default EpiGuard;