import{c as s,i as h,j as e,g as x,k as p,T as m,b as f,d as g,U as b,l as u}from"./index-D11ArGlt.js";/**
 * @license lucide-react v0.453.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=s("AlignJustify",[["path",{d:"M3 12h18",key:"1i2n21"}],["path",{d:"M3 18h18",key:"1h113x"}],["path",{d:"M3 6h18",key:"d0wm0j"}]]);/**
 * @license lucide-react v0.453.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const j=s("File",[["path",{d:"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z",key:"1rqfz7"}],["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}]]);/**
 * @license lucide-react v0.453.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const k=s("Grid3x3",[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",key:"afitv7"}],["path",{d:"M3 9h18",key:"1pudct"}],["path",{d:"M3 15h18",key:"5xshup"}],["path",{d:"M9 3v18",key:"fh3hqa"}],["path",{d:"M15 3v18",key:"14nvp0"}]]),v=[{name:"All",icon:e.jsx(b,{size:20,className:"text-white"}),page:"all"},{name:"Forms",icon:e.jsx(j,{size:20,className:"text-white"}),page:"forms"},{name:"Rank Admin",icon:e.jsx(u,{size:20,className:"text-white"}),page:"rank-admin"},{name:"Masters",icon:e.jsx(y,{size:20,className:"text-white"}),page:"masters"},{name:"Training Matrix",icon:e.jsx(k,{size:20,className:"text-white"}),page:"training-matrix"}];function C({selectedAdminPage:n,setSelectedAdminPage:l,allowedPages:o,isMobileSidebarOpen:w,onCloseMobileSidebar:M}){const r=h(),i=p(r),t=i.sidebarMode==="compact",d=i.sidebarWidth,c=v.filter(a=>o.includes(a.page));return e.jsx(x,{children:e.jsxs("aside",{className:"fixed left-0 top-[67px] h-[calc(100vh-67px)] z-50 flex flex-col transition-all duration-200",style:{width:`${d}px`},"data-testid":"sidebar-desktop",children:[c.map(a=>e.jsxs(m,{delayDuration:0,children:[e.jsx(f,{asChild:!0,children:e.jsx("div",{className:`w-full flex flex-col items-center justify-center cursor-pointer flex-shrink-0 transition-all duration-200 ${n===a.page?"bg-[#52baf3]":"bg-[#16569e] hover:bg-[#1e5fa8]"}`,style:{height:t?"56px":"79px"},onClick:()=>l(a.page),"data-testid":`sidebar-item-${a.page}`,children:e.jsxs("div",{className:"text-white text-[10px] font-normal font-['Roboto',Helvetica] flex flex-col items-center justify-center text-center",children:[e.jsx("div",{className:t?"":"mb-1",children:a.icon}),!t&&e.jsx("div",{className:"leading-tight break-words hyphens-auto max-w-full",children:a.name})]})})}),t&&e.jsx(g,{side:"right",className:"bg-[#16569e] text-white border-none",children:a.name})]},a.page)),e.jsx("div",{className:"w-full flex-1 bg-[#16569e]"})]})})}export{C as S};
