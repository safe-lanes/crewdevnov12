import{c as F,u as $,r as k,j as t,F as g}from"./index-DRZ3j5Kl.js";import{D as P,b as I,c as E,d as T,e as M,B as p,T as U,k as z}from"./checkbox-DcI3TOs9.js";import{d as S}from"./useMasterDataV2-BebfM_0m.js";import{U as B}from"./upload-CyCHN4wT.js";import{E as L}from"./external-link-Diz6wOAQ.js";/**
 * @license lucide-react v0.453.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const R=F("Image",[["rect",{width:"18",height:"18",x:"3",y:"3",rx:"2",ry:"2",key:"1m3agn"}],["circle",{cx:"9",cy:"9",r:"2",key:"af1f0g"}],["path",{d:"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21",key:"1xmnt7"}]]),A=5*1024*1024,C=["application/pdf","image/jpeg","image/png","image/jpg"];function Y({open:h,onOpenChange:x,attachments:r,onAttachmentsChange:c,onDeleteAttachment:f,title:y="Manage Attachments",itemName:u}){const{toast:n}=$(),m=k.useRef(null),j=e=>{const i=e.target.files;if(!i||i.length===0)return;const s=[];Array.from(i).forEach(a=>{if(!C.includes(a.type)){s.push(`${a.name}: Invalid file type. Only PDF, JPG, and PNG are allowed.`);return}if(a.size>A){s.push(`${a.name}: File too large. Maximum size is 5MB.`);return}const l=new FileReader;l.onload=d=>{const o={id:`att-${Date.now()}-${Math.random().toString(36).substr(2,9)}`,name:a.name,type:a.type,size:a.size,data:d.target?.result,uploadedAt:new Date().toISOString(),isNew:!0};c([...r,o]),n({title:"File Uploaded",description:`${a.name} has been attached successfully.`})},l.readAsDataURL(a)}),s.length>0&&n({title:"Upload Error",description:s.join(`
`),variant:"destructive"}),m.current&&(m.current.value="")},N=async e=>{const i=r.find(s=>s.id===e);if(i){const s=i.name||i.fileName||"file",a=i.numericId||parseInt(e,10);if(i.attUuid&&f&&!isNaN(a))try{await f(a,i.attUuid),c(r.filter(l=>l.id!==e)),n({title:"File Deleted",description:`${s} has been deleted.`})}catch{n({title:"Delete Failed",description:`Failed to delete ${s}. Please try again.`,variant:"destructive"})}else i.attUuid?(c(r.map(l=>l.id===e?{...l,isDeleted:!0}:l)),n({title:"File Marked for Deletion",description:`${s} will be removed when you save.`})):(c(r.filter(l=>l.id!==e)),n({title:"File Removed",description:`${s} has been removed.`}))}},v=e=>{const i=document.createElement("div");return i.textContent=e,i.innerHTML},b=e=>{const i=window.open();if(i){const s=e,a=e.name||s.fileName||"file",l=e.type||s.fileType||"",d=e.data||s.fileData||"",o=v(a);l==="application/pdf"?i.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${o}</title>
              <style>
                body { margin: 0; padding: 0; }
                iframe { width: 100%; height: 100vh; border: none; }
              </style>
            </head>
            <body>
              <iframe src="${d}"></iframe>
            </body>
          </html>
        `):l.startsWith("image/")?i.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${o}</title>
              <style>
                body { 
                  margin: 0; 
                  padding: 20px; 
                  display: flex; 
                  justify-content: center; 
                  align-items: center; 
                  min-height: calc(100vh - 40px);
                  background: #f5f5f5;
                }
                img { max-width: 100%; max-height: 100%; object-fit: contain; }
              </style>
            </head>
            <body>
              <img src="${d}" alt="${o}" />
            </body>
          </html>
        `):i.location.href=d,i.document.close()}else n({title:"Unable to open file",description:"Please check if pop-ups are blocked and try again.",variant:"destructive"})},w=e=>e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(1)} KB`:`${(e/(1024*1024)).toFixed(1)} MB`,D=e=>e==="application/pdf"?t.jsx(g,{className:"h-8 w-8 text-red-500"}):t.jsx(R,{className:"h-8 w-8 text-blue-500"});return t.jsx(t.Fragment,{children:t.jsx(P,{open:h,onOpenChange:x,children:t.jsxs(I,{className:"sm:max-w-[500px]",children:[t.jsxs(E,{children:[t.jsx(T,{children:y}),t.jsx(M,{children:u?`Attachments for: ${u}`:"Upload PDF or image files (JPG, PNG). Max 5MB per file."})]}),t.jsxs("div",{className:"space-y-4",children:[t.jsx("input",{ref:m,type:"file",accept:".pdf,.jpg,.jpeg,.png",multiple:!0,onChange:j,className:"hidden","data-testid":"input-file-attachment"}),t.jsx(p,{type:"button",variant:"outline",onClick:()=>m.current?.click(),className:"w-full border-dashed border-2 h-20 hover:bg-gray-50","data-testid":"button-upload-file",children:t.jsxs("div",{className:"flex flex-col items-center gap-1",children:[t.jsx(B,{className:"h-6 w-6 text-gray-400"}),t.jsx("span",{className:"text-sm text-gray-600",children:"Click to upload files"}),t.jsx("span",{className:"text-xs text-gray-400",children:"PDF, JPG, PNG (max 5MB)"})]})}),r.filter(e=>!e.isDeleted).length>0&&t.jsx(S,{className:"h-[200px] border rounded-md p-2",children:t.jsx("div",{className:"space-y-2",children:r.filter(e=>!e.isDeleted).map(e=>t.jsxs("div",{className:"flex items-center gap-3 p-2 border rounded-md bg-gray-50 hover:bg-gray-100","data-testid":`attachment-item-${e.id}`,children:[t.jsx("div",{className:"flex-shrink-0",children:(e.type||e.fileType||"")?.startsWith("image/")?t.jsx("img",{src:e.data||e.fileData,alt:e.name||e.fileName,className:"h-10 w-10 object-cover rounded"}):D(e.type||e.fileType||"")}),t.jsxs("div",{className:"flex-1 min-w-0",children:[t.jsx("p",{className:"text-sm font-medium text-gray-900 truncate",children:e.name||e.fileName}),t.jsx("p",{className:"text-xs text-gray-500",children:w(e.size||parseInt(e.fileSize||"0"))})]}),t.jsxs("div",{className:"flex gap-1",children:[t.jsx(p,{type:"button",variant:"ghost",size:"icon",className:"h-8 w-8 text-gray-500 hover:text-blue-600",onClick:()=>b(e),"data-testid":`button-preview-${e.id}`,children:t.jsx(L,{className:"h-4 w-4"})}),t.jsx(p,{type:"button",variant:"ghost",size:"icon",className:"h-8 w-8 text-gray-500 hover:text-red-600",onClick:()=>N(e.id),"data-testid":`button-remove-${e.id}`,children:t.jsx(U,{className:"h-4 w-4"})})]})]},e.id))})}),r.filter(e=>!e.isDeleted).length===0&&t.jsxs("div",{className:"text-center py-6 text-gray-500",children:[t.jsx(g,{className:"h-10 w-10 mx-auto mb-2 text-gray-300"}),t.jsx("p",{className:"text-sm",children:"No attachments yet"})]})]}),t.jsx(z,{children:t.jsxs("div",{className:"flex justify-between w-full items-center",children:[t.jsxs("span",{className:"text-sm text-gray-500",children:[r.filter(e=>!e.isDeleted).length," file",r.filter(e=>!e.isDeleted).length!==1?"s":""," attached"]}),t.jsx(p,{type:"button",onClick:()=>x(!1),"data-testid":"button-close-attachment-dialog",children:"Done"})]})})]})})})}export{Y as F,R as I};
