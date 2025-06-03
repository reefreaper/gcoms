
import logo from '../docs_img.jpeg';

const Navigation = ({ account }) => {
  return (
    <div className='flex flex-row'>
      <img
        alt="logo"
        src={logo}
        width="40"
        height="40"
        className="d-inline-block align-top mx-3"
      />
      <div href="#">Asset Docs</div>
      <div className="">
        <div className="text-grey-300">
          {account}
        </div>
      </div>
    </div>
  );
}

export default Navigation;
