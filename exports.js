const HPHExports={
  sanitizeBackupData(data){
    const clean=structuredClone(data||{});
    if(window.HPH_USE_SUPABASE && window.HPHSupabase?.ready){
      clean.users=(clean.users||[])
        .filter(user=>user.email || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(user.id||"")))
        .map(user=>({id:user.id,username:user.username||"",email:user.email||"",password:"",role:user.role||"user",createdAt:user.createdAt,updatedAt:user.updatedAt}));
    }else{
      clean.users=(clean.users||[]).map(user=>({...user,password:user.password||""}));
    }
    return clean;
  },
  downloadBackup(data){
    const backup={app:"PH Estate Manager",version:"stage-15.3",createdAt:new Date().toISOString(),data:this.sanitizeBackupData(data)};
    const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json;charset=utf-8"});
    const stamp=new Date().toISOString().slice(0,10);
    this.downloadBlob(blob,`PH_Estate_Manager_Backup_${stamp}.json`);
  },
  downloadBlob(blob,filename){
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=url;
    link.download=filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
};
