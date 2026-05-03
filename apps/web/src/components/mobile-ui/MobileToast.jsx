import { toast } from 'sonner';

const MobileToast = {
  success: (message) => toast.success(message),
  error: (message) => toast.error(message),
  info: (message) => toast.info(message),
};

export default MobileToast;
