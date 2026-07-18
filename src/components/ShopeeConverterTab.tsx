import React, { useState } from "react";
import { 
  Link, 
  Search, 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink, 
  Plus, 
  ShoppingBag, 
  Tag 
} from "lucide-react";
import { ShopeeProduct } from "../types";

interface ShopeeConverterTabProps {
  products: ShopeeProduct[];
  shopeePartnerId: string;
  onAddProduct: (product: ShopeeProduct) => void;
  onSelectProduct: (product: ShopeeProduct) => void;
}

const PRESET_PRODUCTS: Omit<ShopeeProduct, "affiliateUrl">[] = [
  {
    id: "p1",
    name: "พัดลมพกพามินิ เทอร์โบชาร์จ ลมแรงสะใจ 100 ระดับ",
    originalUrl: "https://shopee.co.th/product/12345/987654",
    price: "฿299",
    category: "เครื่องใช้ไฟฟ้าขนาดเล็ก",
    imageUrl: "https://images.unsplash.com/photo-1618944847023-38aa001275ff?w=400&auto=format&fit=crop&q=60",
    rating: 4.9
  },
  {
    id: "p2",
    name: "เครื่องตัดขุยผ้าไฟฟ้าอัจฉริยะ คืนชีพเสื้อตัวโปรดใน 3 วินาที",
    originalUrl: "https://shopee.co.th/product/43210/111222",
    price: "฿189",
    category: "ของใช้ในบ้าน",
    imageUrl: "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=400&auto=format&fit=crop&q=60",
    rating: 4.8
  },
  {
    id: "p3",
    name: "มินิโปรเจคเตอร์พกพา HD 1080P เปลี่ยนห้องนอนเป็นโรงหนังส่วนตัว",
    originalUrl: "https://shopee.co.th/product/99999/888888",
    price: "฿1,250",
    category: "Gadgets / ไอที",
    imageUrl: "https://images.unsplash.com/photo-1535016120720-40c646be5580?w=400&auto=format&fit=crop&q=60",
    rating: 4.7
  },
  {
    id: "p4",
    name: "เครื่องม้วนผมลอนอัตโนมัติ ลอนสวยเด้ง สไตล์เกาหลี ไม่ทำร้ายผม",
    originalUrl: "https://shopee.co.th/product/88888/444444",
    price: "฿450",
    category: "บิวตี้ & ความงาม",
    imageUrl: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&auto=format&fit=crop&q=60",
    rating: 4.9
  }
];

export default function ShopeeConverterTab({ products, shopeePartnerId, onAddProduct, onSelectProduct }: ShopeeConverterTabProps) {
  const [inputUrl, setInputUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("ของใช้ในบ้าน");
  const [imageUrl, setImageUrl] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleConvertLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/convert-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: inputUrl,
          partnerId: shopeePartnerId
        })
      });
      const data = await response.json();
      
      const newProduct: ShopeeProduct = {
        id: "prod_" + Date.now(),
        name: productName || "สินค้าแปลกลิงก์ด่วน " + new Date().toLocaleDateString("th-TH"),
        originalUrl: inputUrl,
        affiliateUrl: data.affiliateUrl,
        price: price || "฿199",
        category: category,
        imageUrl: imageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&auto=format&fit=crop&q=60",
        rating: 4.8
      };

      onAddProduct(newProduct);
      
      // Reset form
      setInputUrl("");
      setProductName("");
      setPrice("");
      setImageUrl("");
    } catch (err) {
      console.error("Error converting link:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPreset = async (preset: Omit<ShopeeProduct, "affiliateUrl">) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/convert-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: preset.originalUrl,
          partnerId: shopeePartnerId
        })
      });
      const data = await response.json();

      const newProduct: ShopeeProduct = {
        ...preset,
        affiliateUrl: data.affiliateUrl
      };

      onAddProduct(newProduct);
    } catch (err) {
      console.error("Error adding preset:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Introduction Card */}
      <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-slate-950 p-6 rounded-2xl border border-orange-500/20">
        <div className="flex items-start gap-4">
          <div className="bg-orange-500 text-white p-3 rounded-xl">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">ระบบจัดการลิงก์พันธมิตร Shopee Affiliate</h2>
            <p className="text-slate-300 text-sm mt-1 leading-relaxed">
              เครื่องมือแปลงลิงก์สินค้าปกติใน Shopee ให้เป็นลิงก์พันธมิตรที่มีรหัส **Partner ID: {shopeePartnerId}** โดยอัตโนมัติ 
              หลังจากนั้นคุณสามารถคลิกเลือกสินค้าเพื่อนำไปเขียนพล็อตวิดีโอแบบหักมุมได้ทันที
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Form: Manual Link Converter */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <Link className="w-5 h-5 text-orange-500" />
              แปลงลิงก์ด่วนใหม่
            </h3>
            <form onSubmit={handleConvertLink} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">ลิงก์ปกติจาก Shopee</label>
                <input 
                  type="url" 
                  required
                  placeholder="https://shopee.co.th/product/..."
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">ชื่อสินค้า (ภาษาไทย)</label>
                <input 
                  type="text" 
                  placeholder="เช่น มินิพัดลมพกพาสีขาวพาสเทล"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">ราคา (บาท)</label>
                  <input 
                    type="text" 
                    placeholder="เช่น ฿250"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">หมวดหมู่</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all"
                  >
                    <option value="เครื่องใช้ไฟฟ้าขนาดเล็ก">เครื่องใช้ไฟฟ้าขนาดเล็ก</option>
                    <option value="ของใช้ในบ้าน">ของใช้ในบ้าน</option>
                    <option value="Gadgets / ไอที">Gadgets / ไอที</option>
                    <option value="บิวตี้ & ความงาม">บิวตี้ & ความงาม</option>
                    <option value="แม่และเด็ก">แม่และเด็ก</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold mb-1.5 uppercase tracking-wider">URL รูปภาพตัวอย่าง (ถ้ามี)</label>
                <input 
                  type="url" 
                  placeholder="https://images.unsplash.com/..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-orange-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
                />
              </div>

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-800 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    แปลงเป็นลิงก์พันธมิตรด่วน
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Quick Presets */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-white font-bold text-base mb-3 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              สินค้าแนะนำสำหรับคลิปหักมุม (Viral Presets)
            </h3>
            <p className="text-xs text-slate-400 mb-4">สินค้าเหล่านี้มีอัตราผลตอบแทนและยอดชมสูง คลิกบวกเพื่อแปลงลิงก์อัตโนมัติ</p>
            <div className="space-y-3">
              {PRESET_PRODUCTS.map((preset) => {
                const isAdded = products.some(p => p.name === preset.name);
                return (
                  <div key={preset.id} className="flex items-center gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800/60 justify-between">
                    <div className="flex items-center gap-3">
                      <img 
                        src={preset.imageUrl} 
                        alt={preset.name} 
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div>
                        <h4 className="text-xs font-semibold text-white line-clamp-1">{preset.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] font-bold text-orange-400">{preset.price}</span>
                          <span className="text-[10px] text-slate-500 font-mono flex items-center gap-0.5">
                            <Tag className="w-3 h-3 text-slate-600" /> {preset.category}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      disabled={isAdded || isLoading}
                      onClick={() => handleAddPreset(preset)}
                      className={`p-1.5 rounded-lg transition-all ${
                        isAdded 
                          ? "bg-slate-800 text-slate-500 cursor-not-allowed" 
                          : "bg-orange-500/10 text-orange-400 hover:bg-orange-500 hover:text-white"
                      }`}
                    >
                      {isAdded ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Added Products List */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-white font-bold text-lg mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-sky-400" />
                คลังสินค้าพันธมิตร ({products.length} ชิ้น)
              </span>
            </h3>

            {products.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
                <ShoppingBag className="w-12 h-12 text-slate-700 mx-auto mb-3 animate-pulse" />
                <p className="text-slate-300 font-medium">ไม่มีสินค้าในคลัง</p>
                <p className="text-slate-500 text-xs mt-1">เพิ่มสินค้าด่วนจากแบบฟอร์มหรือคลิกเพิ่มจากรายการแนะนำด้านซ้าย</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map((product) => (
                  <div key={product.id} className="bg-slate-950 rounded-xl border border-slate-800/80 p-4 flex flex-col justify-between hover:border-orange-500/30 transition-all group">
                    <div className="space-y-3">
                      <div className="relative">
                        <img 
                          src={product.imageUrl} 
                          alt={product.name} 
                          referrerPolicy="no-referrer"
                          className="w-full h-36 rounded-lg object-cover"
                        />
                        <span className="absolute top-2 left-2 text-[10px] bg-black/70 text-amber-400 font-bold px-2 py-0.5 rounded-full border border-amber-400/20">
                          ⭐️ {product.rating}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">{product.category}</span>
                        <h4 className="text-sm font-semibold text-white line-clamp-2 mt-1 leading-relaxed group-hover:text-orange-400 transition-colors">{product.name}</h4>
                        <p className="text-base font-bold text-emerald-400 mt-1">{product.price}</p>
                      </div>
                    </div>

                    <div className="space-y-2 mt-4 pt-4 border-t border-slate-900">
                      {/* Short affiliate display */}
                      <div className="flex items-center gap-2 p-2 bg-slate-900 rounded-lg justify-between border border-slate-800/40">
                        <span className="text-[11px] font-mono text-slate-400 truncate max-w-[150px]">{product.affiliateUrl}</span>
                        <button 
                          onClick={() => handleCopy(product.affiliateUrl, product.id)}
                          className="text-slate-400 hover:text-white transition-all p-1 hover:bg-slate-800 rounded"
                        >
                          {copiedId === product.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => onSelectProduct(product)}
                          className="flex-1 bg-orange-500/10 hover:bg-orange-500 text-orange-400 hover:text-white font-medium text-xs py-2 px-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          แต่งบทด้วยชิ้นนี้
                        </button>
                        <a
                          href={product.affiliateUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
