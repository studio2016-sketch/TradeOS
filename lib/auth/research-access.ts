/** Role gate for TradeOS private research operations.
 * Input identity MUST come from a verified Neon Auth server session, never a request body.
 * This module does not establish identity or create invitations.
 */
export type ResearchPrincipal={userId:string;emailVerified:boolean;role:"owner"|"researcher"|"viewer"|"unapproved";accountDisabled:boolean};
export type ResearchAction="read"|"upload"|"investigate"|"invite";
export function mayAccessResearch(principal:ResearchPrincipal|null,action:ResearchAction){
 if(!principal||principal.accountDisabled||!principal.emailVerified)return false;
 if(principal.role==="owner")return true;
 if(principal.role==="researcher")return action==="read"||action==="upload"||action==="investigate";
 if(principal.role==="viewer")return action==="read";
 return false;
}
export const privateAccessConfiguration={registration:"invite_only_target",selfSignupApproved:false,uploadGatewayEnabled:false,anonymousResearchAccess:false,neonSignupSettingMustBeDisabled:true} as const;
