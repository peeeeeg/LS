'use client';

export default function TestPage() {
  return (
    <div className="bg-gray-100 min-h-screen p-4">
      <h1 className="text-2xl font-bold text-red-600 mb-4">Tailwind CSS 测试页面</h1>
      <div className="bg-white rounded-lg shadow-md p-4">
        <p className="text-blue-500 mb-4">这是一个测试文本，用于验证 Tailwind CSS 是否正常工作。</p>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors">
          测试按钮
        </button>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-green-100 p-2 rounded">测试1</div>
          <div className="bg-yellow-100 p-2 rounded">测试2</div>
          <div className="bg-purple-100 p-2 rounded">测试3</div>
        </div>
      </div>
    </div>
  );
}