import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
export const money=(value:number)=>new Intl.NumberFormat('fr-MA',{maximumFractionDigits:0}).format(value)+' MAD'
export const date=(value:string)=>new Date(value.slice(0,10)+'T12:00:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})
export const day=(offset=0)=>{const d=new Date();d.setDate(d.getDate()+offset);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export const API=import.meta.env.VITE_API_URL||''
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
 const token=sessionStorage.getItem('atlas-token'); const headers=new Headers(options.headers)
 if(!(options.body instanceof FormData))headers.set('Content-Type','application/json')
 if(token)headers.set('Authorization',`Bearer ${token}`)
 const response=await fetch(API+path,{...options,headers})
 if(!response.ok){const body=await response.json().catch(()=>null);throw new Error(body?.message||body?.title||`Une erreur est survenue (${response.status}).`)}
 if(response.status===204)return undefined as T
 return response.json()
}
export const post=<T>(path:string,body:unknown={})=>api<T>(path,{method:'POST',body:JSON.stringify(body)})
export interface User{id:string;fullName:string;email:string;role:string}
export interface Vehicle{id:number;brand:string;model:string;year:number;category:string;transmission:string;fuel:string;seats:number;dailyRate:number;deposit:number;imageUrl:string;city:string;description:string;features:string[];status:string;rating:number}
export interface Location{id:number;name:string;address:string;city:string;latitude:number;longitude:number;phone:string}
export interface Booking{id:number;reference:string;vehicleId:number;vehicleName:string;vehicleImageUrl:string;userName:string;userEmail:string;startDate:string;endDate:string;pickupLocationName:string;returnLocationName:string;days:number;dailyRate:number;total:number;deposit:number;status:string;createdAt:string;returnedAt?:string;returnNotes?:string}
export interface Quote{days:number;dailyRate:number;rentalAmount:number;insuranceAmount:number;extrasAmount:number;total:number;deposit:number}
export interface Dashboard{totalRevenue:number;totalBookings:number;activeRentals:number;availableVehicles:number;monthlyRevenue:{month:string;revenue:number}[];recentBookings:Booking[]}
export interface Notice{id:number;title:string;message:string;createdAt:string;isRead:boolean}
export const statusLabel:Record<string,string>={Confirmed:'Confirmée',Active:'En cours',Completed:'Terminée',Cancelled:'Annulée',Available:'Disponible',Maintenance:'Maintenance'}
