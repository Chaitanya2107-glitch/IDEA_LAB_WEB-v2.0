
import React, { useState, useEffect } from 'react';
import { Search, Package, ShoppingCart, X, Plus, CheckCircle, Filter, FileText, UserCircle, Minus, Loader2, ArrowLeft } from 'lucide-react';
import { User, InventoryItem, IndentItem, Indent } from '../../types';
import { authService } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';

// Placeholder photos for items without their own image (served from /public).
const LAB_PHOTOS = ['/img/comp/DSC09502.JPG', '/img/comp/DSC09516.JPG', '/img/comp/DSC09524.JPG', '/img/comp/DSC09551.JPG', '/img/comp/DSC09581.JPG', '/img/comp/DSC09591.JPG'];

interface ComponentsProps {
  user?: User;
}

const Components: React.FC<ComponentsProps> = ({ user }) => {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<IndentItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [showIndentForm, setShowIndentForm] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Filter state
  const [showFilter, setShowFilter] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  const isGuest = user?.type === 'non-university';

  useEffect(() => {
    // Restrict access for guest users
    if (isGuest) {
        navigate('/dashboard');
        return;
    }

    const loadCatalog = async () => {
        const items = await authService.getInventory(); // Now uses real API
        setCatalog(items);
        setLoading(false);
    };
    loadCatalog();
  }, [isGuest, navigate]);
  
  // Get unique categories
  const categories = ['All', ...Array.from(new Set(catalog.map(item => item.category)))];

  // Indent Form State
  const [indentData, setIndentData] = useState({
    projectTitle: '',
    supervisor: '',
    purpose: 'academic_project'
  });

  const filteredCatalog = catalog.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const addToCart = (item: InventoryItem) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
       if (existing.quantity < item.availableQuantity) {
          setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
       }
    } else {
       setCart([...cart, { 
         id: item.id, 
         name: item.name, 
         category: item.category, 
         type: item.type === 'consumable' ? 'consumable' : 'non-consumable', 
         quantity: 1, 
         costPerUnit: item.costPerUnit 
       }]);
    }
  };

  const removeFromCart = (itemId: string) => {
    const existing = cart.find(c => c.id === itemId);
    if (existing && existing.quantity > 1) {
       setCart(cart.map(c => c.id === itemId ? { ...c, quantity: c.quantity - 1 } : c));
    } else {
       setCart(cart.filter(c => c.id !== itemId));
    }
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.costPerUnit * item.quantity), 0);
  };

  const handleCheckoutClick = () => {
    setShowIndentForm(true);
  };

  const submitIndent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSubmitting(true);
    
    const totalCost = getCartTotal();

    // Map frontend Indent to backend Indent (user_id, tenant_id, items_json)
    const newIndent: Indent = {
        id: `IND-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
        user_name: user.name, // Backend expects user_name
        user_id: user.id, // Backend expects user_id
        tenant_id: user.tenant_id, // Backend expects tenant_id
        projectTitle: indentData.projectTitle,
        supervisor: indentData.supervisor,
        purpose: indentData.purpose, // Backend expects purpose
        items_json: cart, // Backend expects items_json (Corrected: cart is already IndentItem[])
        requestDate: new Date().toLocaleDateString(),
        status: 'pending', // CHANGED: Now pending so it shows in Staff Portal Requests
        paymentStatus: totalCost > 0 ? 'pending' : 'na',
        totalCost: totalCost
    };

    await authService.createIndent(newIndent);
    
    setIsSubmitting(false);
    setShowIndentForm(false);
    setCheckoutSuccess(true);
    
    setTimeout(() => {
        setCart([]);
        setShowCart(false);
        setCheckoutSuccess(false);
        setIndentData({ projectTitle: '', supervisor: '', purpose: 'academic_project' });
    }, 2000);
  };

  if (loading || isGuest) {
      return (
          <div className="flex min-h-screen items-center justify-center bg-slate-50 pt-16" role="status">
              <Loader2 className="h-8 w-8 animate-spin text-brand-600" aria-hidden="true" />
              <span className="sr-only">Loading</span>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-16">

      {/* Page Header */}
      <section className="bg-slate-50 py-8 md:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
           {/* Back to Dashboard */}
           <div className="mb-6">
                <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700 hover:underline underline-offset-4">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Dashboard
                </Link>
           </div>

           {/* Eyebrow */}
            <p className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold uppercase tracking-wider text-brand-600">
                <Package className="h-4 w-4 text-brand-500" aria-hidden="true" />
                Component Catalog
            </p>

            <h1 className="mt-2 font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Hardware <span className="text-brand-600">Library</span>
            </h1>

            <p className="mt-4 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600">
                Access our state-of-the-art component library. From microcontrollers to sensors, everything you need to build the future is right here.
            </p>
        </div>
      </section>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">

        {/* Search Bar & Filter */}
        <div className="mb-8 flex flex-col gap-4">
            <div className="flex gap-3">
                <div className="relative flex-grow">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <input
                        type="text"
                        placeholder="Search components (e.g., 'Arduino', 'Sensor')..."
                        aria-label="Search components"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pl-10 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                    />
                </div>
                <button
                    onClick={() => setShowFilter(!showFilter)}
                    aria-expanded={showFilter}
                    aria-label="Filter"
                    className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors ${showFilter ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                    <Filter className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Filter</span>
                </button>
            </div>

            {/* Filter Dropdown */}
            {showFilter && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm animate-slide-up">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Categories</p>
                    <div className="flex flex-wrap gap-2">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                aria-pressed={selectedCategory === cat}
                                className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${selectedCategory === cat ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCatalog.map((item) => {
                const cartItem = cart.find(c => c.id === item.id);
                const quantityInCart = cartItem ? cartItem.quantity : 0;
                const isDisabled = item.availableQuantity === 0;

                // Placeholder images for demo
                const imageUrl = LAB_PHOTOS[[...item.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % LAB_PHOTOS.length];

                return (
                <div key={item.id} className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md hover:border-slate-300">
                    <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                    <img src={imageUrl} alt={item.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                    <div className="absolute top-3 left-3 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700 shadow-sm">
                        {item.category}
                    </div>
                    </div>
                    <div className="p-5">
                    <h3 className="font-display text-lg font-semibold text-slate-900">{item.name}</h3>
                    <div className="mb-4 mt-2 flex items-center justify-between gap-3">
                         <div className="min-w-0"> {/* Added min-w-0 to prevent overflow */}
                            <span className={`text-sm font-medium ${item.availableQuantity > 0 ? 'text-green-700' : 'text-red-600'}`}>
                            {item.availableQuantity} in Stock
                            </span>
                            <div className="text-xs text-slate-500 capitalize">{item.type}</div>
                         </div>
                         {item.costPerUnit > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-600/20 tabular-nums">₹{item.costPerUnit}</span>}
                    </div>

                    {!isDisabled ? (
                        <div className="flex items-center gap-3">
                            {quantityInCart > 0 ? (
                                <>
                                <button
                                    onClick={() => removeFromCart(item.id)}
                                    aria-label={`Remove one ${item.name}`}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
                                >
                                    <Minus className="h-4 w-4" aria-hidden="true" />
                                </button>
                                <span className="w-8 text-center text-base font-semibold tabular-nums text-slate-900">{quantityInCart}</span>
                                <button
                                    onClick={() => {
                                        const catalogItem = catalog.find(c => c.id === item.id);
                                        if (catalogItem && quantityInCart < catalogItem.availableQuantity) {
                                            addToCart(catalogItem);
                                        }
                                    }}
                                    aria-label={`Add one ${item.name}`}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Plus className="h-4 w-4" aria-hidden="true" />
                                </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => addToCart(item)}
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Plus className="h-4 w-4" aria-hidden="true" /> Add to Cart
                                </button>
                            )}
                        </div>
                    ) : (
                        <button disabled className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-semibold text-slate-500">
                             Out of Stock
                        </button>
                    )}

                    </div>
                </div>
                );
            })}
        </div>
      </div>

      {/* ... Rest of Cart Modal Logic remains the same ... */}
       {/* FLOATING CART BUTTON */}
      {cart.length > 0 && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-8 right-8 z-30 inline-flex items-center gap-3 rounded-lg bg-brand-600 px-5 py-3 text-base font-semibold text-white shadow-lg transition-colors hover:bg-brand-700 animate-slide-up"
        >
          <div className="relative">
             <ShoppingCart className="h-5 w-5" aria-hidden="true" />
             <span className="absolute -top-2.5 -right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-semibold text-brand-700 ring-2 ring-brand-600">
               {cart.reduce((acc, item) => acc + item.quantity, 0)}
             </span>
          </div>
          <span>View Cart</span>
        </button>
      )}

      {/* CART MODAL */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setShowCart(false)}></div>
          <div role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title" className="relative flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl animate-fade-in">
             <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
               <h2 id="cart-drawer-title" className="flex items-center gap-2 font-display text-xl font-semibold text-slate-900">
                 <ShoppingCart className="h-5 w-5 text-slate-400" aria-hidden="true" /> Your Cart
               </h2>
               <button onClick={() => setShowCart(false)} aria-label="Close cart" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
                 <X className="h-5 w-5" aria-hidden="true" />
               </button>
             </div>

             {checkoutSuccess ? (
                <div className="flex flex-grow flex-col items-center justify-center p-8 text-center" role="status">
                     <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600">
                         <CheckCircle className="h-6 w-6" aria-hidden="true" />
                     </div>
                     <h3 className="font-display text-xl font-semibold text-slate-900">Indent Submitted!</h3>
                     <p className="mt-1 text-sm text-slate-500">Waiting for staff approval. Check dashboard.</p>
                </div>
             ) : showIndentForm ? (
                <div className="flex flex-grow flex-col overflow-y-auto p-6">
                    <div className="mb-6 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                       <FileText className="h-5 w-5 shrink-0" aria-hidden="true" />
                       <div>
                          <h3 className="font-semibold">Digital Indent</h3>
                          <p className="text-xs">Required for University records.</p>
                       </div>
                    </div>

                    <form onSubmit={submitIndent} className="space-y-4">
                       <div>
                          <label htmlFor="indent-project-title" className="mb-1.5 block text-sm font-medium text-slate-700">Project Title</label>
                          <input
                            id="indent-project-title"
                            required
                            type="text"
                            className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                            placeholder="e.g. IoT Weather Station"
                            value={indentData.projectTitle}
                            onChange={(e) => setIndentData({...indentData, projectTitle: e.target.value})}
                          />
                       </div>
                       <div>
                          <label htmlFor="indent-supervisor" className="mb-1.5 block text-sm font-medium text-slate-700">Supervisor / Faculty</label>
                          <div className="relative">
                             <UserCircle className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                             <input
                                id="indent-supervisor"
                                required
                                type="text"
                                className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pl-10 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                                placeholder="Faculty Name"
                                value={indentData.supervisor}
                                onChange={(e) => setIndentData({...indentData, supervisor: e.target.value})}
                             />
                          </div>
                       </div>
                       <div>
                          <label htmlFor="indent-purpose" className="mb-1.5 block text-sm font-medium text-slate-700">Purpose</label>
                          <select
                             id="indent-purpose"
                             className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                             value={indentData.purpose}
                             onChange={(e) => setIndentData({...indentData, purpose: e.target.value})}
                          >
                             <option value="academic_project">Academic Project</option>
                             <option value="research">Research</option>
                             <option value="competition">Competition / Hackathon</option>
                             <option value="hobby">Personal Learning</option>
                          </select>
                       </div>

                       <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <p className="mb-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Order Summary</p>
                          <ul className="space-y-2 text-sm text-slate-700">
                             {cart.map(i => (
                                <li key={i.id} className="flex items-center justify-between gap-3">
                                   <span>{i.name} <span className="text-xs text-slate-500">x{i.quantity}</span></span>
                                   <span className="font-medium tabular-nums text-slate-900">
                                      {i.costPerUnit > 0 ? `₹${i.costPerUnit * i.quantity}` : 'Free'}
                                   </span>
                                </li>
                             ))}
                          </ul>
                          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                              <span className="text-sm font-semibold text-slate-900">Total Estimated Cost</span>
                              <span className="font-display text-lg font-bold tabular-nums text-slate-900">₹{getCartTotal()}</span>
                          </div>
                       </div>

                       <div className="flex gap-3 pt-4">
                          <button
                             type="button"
                             disabled={isSubmitting}
                             onClick={() => setShowIndentForm(false)}
                             className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                             Back
                          </button>
                          <button
                             type="submit"
                             disabled={isSubmitting}
                             aria-busy={isSubmitting}
                             className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                             {isSubmitting ? 'Processing...' : 'Submit Indent'}
                          </button>
                       </div>
                    </form>
                </div>
             ) : (
                <>
                    <div className="flex-grow space-y-3 overflow-y-auto p-6">
                    {cart.map(item => (
                        <div key={item.id} className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-3">
                            <div className="min-w-0 flex-grow">
                                <h4 className="text-sm font-semibold text-slate-900">{item.name}</h4>
                                <div className="mt-1 flex items-center gap-2">
                                    <span className="text-xs text-slate-500 capitalize">{item.type}</span>
                                    {item.costPerUnit > 0 && <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-600/20 tabular-nums">₹{item.costPerUnit}/unit</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                                <button onClick={() => removeFromCart(item.id)} aria-label={`Remove one ${item.name}`} className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-white hover:text-slate-900">-</button>
                                <span className="w-6 text-center text-sm font-semibold tabular-nums text-slate-900">{item.quantity}</span>
                                <button
                                    onClick={() => {
                                        const catalogItem = catalog.find(c => c.id === item.id);
                                        if (catalogItem && item.quantity < catalogItem.availableQuantity) {
                                            addToCart(catalogItem);
                                        }
                                    }}
                                    aria-label={`Add one ${item.name}`}
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    ))}
                    </div>

                    <div className="border-t border-slate-200 bg-slate-50 p-6">
                    <div className="mb-4 flex justify-between text-sm">
                        <span className="text-slate-500">Total Items</span>
                        <span className="font-medium tabular-nums text-slate-900">{cart.reduce((a,b) => a + b.quantity, 0)}</span>
                    </div>
                    {getCartTotal() > 0 && (
                        <div className="mb-4 flex justify-between text-sm font-semibold text-brand-600">
                            <span>Estimated Cost</span>
                            <span className="tabular-nums">₹{getCartTotal()}</span>
                        </div>
                    )}
                    <button
                        onClick={handleCheckoutClick}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Proceed to Indent <FileText className="h-5 w-5" aria-hidden="true" />
                    </button>
                    </div>
                </>
             )}
          </div>
        </div>
      )}

    </div>
  );
};

export default Components;
