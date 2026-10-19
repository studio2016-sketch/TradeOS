"use client";
import Link from "next/link";
import {authClient} from "../../lib/auth/client";
export default function AccountStatus(){
 const {data:session,isPending,error}=authClient.useSession();
 if(isPending)return <span style={{color:"#adc2d1"}}>Checking secure session…</span>;
 if(error)return <span style={{color:"#ffb0b0"}}>Session check unavailable. Please sign in again.</span>;
 if(!session?.user)return <Link href="/sign-in" style={{color:"#e8c98a"}}>Sign in to private research</Link>;
 return <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
 <span style={{color:"#a6e3bf"}}>Signed in as {session.user.email}</span>
 <span style={{color:"#d9c08a",fontSize:12}}>Research permissions are verified separately.</span>
 <button type="button" onClick={async()=>{await authClient.signOut();window.location.assign("/sign-in");}} style={{background:"#263b4d",border:"1px solid #8295a5",padding:"8px 12px",borderRadius:8,color:"#fff"}}>Sign Out</button>
 </div>;
}
